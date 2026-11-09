import {
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
  type HubConnection,
  type IRetryPolicy,
} from '@microsoft/signalr';
import { sessionStore } from '@/shared/api/session-store';
import { env } from '@/shared/config/env';
import { HUB_METHODS, REALTIME_EVENTS, type ConnectionState, type RealtimeEventMap, type RealtimeEventName } from './events';

type Handler<K extends RealtimeEventName> = (payload: RealtimeEventMap[K]) => void;
type AnyHandler = (payload: unknown) => void;
type Listener = () => void;

const MAX_RETRY_DELAY_MS = 30_000;
const RESTART_DELAY_MS = 5_000;

/** Retries forever with capped exponential backoff (a KDS screen must recover on its own). */
const retryPolicy: IRetryPolicy = {
  nextRetryDelayInMilliseconds: ({ previousRetryCount }) => Math.min(MAX_RETRY_DELAY_MS, 1000 * 2 ** previousRetryCount),
};

/**
 * ONE HubConnection for the app. Joins the current branch group on every (re)connect and
 * notifies `onReconnected` listeners so the app can refetch (SignalR only notifies).
 */
class HubManager {
  private connection: HubConnection | null = null;
  private branchId: string | null = null;
  private state: ConnectionState = 'disconnected';
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly handlers = new Map<RealtimeEventName, Set<AnyHandler>>();
  private readonly stateListeners = new Set<Listener>();
  private readonly reconnectListeners = new Set<Listener>();
  private readonly connectedHooks = new Set<(connection: HubConnection) => Promise<void>>();

  getState = (): ConnectionState => this.state;

  async start(branchId: string): Promise<void> {
    if (this.connection && this.branchId === branchId) return;
    await this.stop();
    this.branchId = branchId;
    this.connection = this.build();
    await this.connect(false);
  }

  async stop(): Promise<void> {
    if (this.restartTimer) clearTimeout(this.restartTimer);
    this.restartTimer = null;
    const connection = this.connection;
    this.connection = null;
    this.branchId = null;
    if (connection) await connection.stop();
    this.setState('disconnected');
  }

  on<K extends RealtimeEventName>(name: K, handler: Handler<K>): () => void {
    const set = this.handlers.get(name) ?? new Set<AnyHandler>();
    set.add(handler as AnyHandler);
    this.handlers.set(name, set);
    return () => set.delete(handler as AnyHandler);
  }

  /** For extra hub methods, e.g. JoinKitchenStation (KDS). */
  async invoke(method: string, ...args: unknown[]): Promise<void> {
    if (this.connection?.state === HubConnectionState.Connected) await this.connection.invoke(method, ...args);
  }

  /** Runs on every successful (re)connect — use for group joins beyond the branch (e.g. kitchen station). */
  onConnected(hook: (connection: HubConnection) => Promise<void>): () => void {
    this.connectedHooks.add(hook);
    if (this.connection?.state === HubConnectionState.Connected) void hook(this.connection);
    return () => this.connectedHooks.delete(hook);
  }

  onReconnected(listener: Listener): () => void {
    this.reconnectListeners.add(listener);
    return () => this.reconnectListeners.delete(listener);
  }

  subscribeState(listener: Listener): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  private build(): HubConnection {
    const connection = new HubConnectionBuilder()
      .withUrl(env.hubUrl, { accessTokenFactory: () => sessionStore.getAccessToken() ?? '' })
      .withAutomaticReconnect(retryPolicy)
      .configureLogging(env.isProduction ? LogLevel.Error : LogLevel.Warning)
      .build();

    REALTIME_EVENTS.forEach((name) => {
      connection.on(name, (payload: RealtimeEventMap[typeof name]) => {
        if (this.branchId && payload?.branchId && payload.branchId !== this.branchId) return;
        this.handlers.get(name)?.forEach((handler) => handler(payload));
      });
    });
    connection.onreconnecting(() => this.setState('reconnecting'));
    connection.onreconnected(() => void this.afterConnected(connection, true));
    connection.onclose(() => {
      if (this.connection !== connection) return;
      this.setState('disconnected');
      this.scheduleRestart();
    });
    return connection;
  }

  private async connect(isReconnect: boolean): Promise<void> {
    const connection = this.connection;
    if (!connection) return;
    this.setState('connecting');
    try {
      await connection.start();
    } catch (error) {
      if (this.connection !== connection) return;
      console.warn('[realtime] connection failed, retrying', error);
      this.setState('disconnected');
      this.scheduleRestart();
      return;
    }
    await this.afterConnected(connection, isReconnect);
  }

  private async afterConnected(connection: HubConnection, isReconnect: boolean): Promise<void> {
    try {
      if (this.branchId) await connection.invoke(HUB_METHODS.joinBranch, this.branchId);
      await Promise.all([...this.connectedHooks].map((hook) => hook(connection)));
    } catch (error) {
      console.warn('[realtime] joining groups failed', error);
    }
    this.setState('connected');
    if (isReconnect) this.reconnectListeners.forEach((listener) => listener());
  }

  private scheduleRestart(): void {
    if (this.restartTimer || !this.connection) return;
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      void this.connect(true);
    }, RESTART_DELAY_MS);
  }

  private setState(next: ConnectionState): void {
    if (this.state === next) return;
    this.state = next;
    this.stateListeners.forEach((listener) => listener());
  }
}

export const hubManager = new HubManager();
