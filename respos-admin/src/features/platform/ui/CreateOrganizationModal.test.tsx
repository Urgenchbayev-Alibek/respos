import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { api, http, HttpResponse, problem, server } from '@/test/msw-server';
import { makeAuth, makeUser, renderWithProviders } from '@/test/test-utils';
import { CreateOrganizationModal } from './CreateOrganizationModal';

const platformAdmin = makeAuth(makeUser({ isPlatformAdmin: true, currentOrganization: null, permissions: [] }));
const plans = [{ id: 'p1', code: 'business', name: 'Business', maxBranches: 3, maxUsers: 50, isActive: true, features: [] }];

async function fillValid() {
  await userEvent.type(screen.getByLabelText(/Название организации/), 'Chayxona Plov');
  await userEvent.selectOptions(screen.getByLabelText(/Тариф/), 'business');
  await userEvent.type(screen.getByLabelText(/Первый филиал/), 'Центр');
  await userEvent.type(screen.getByLabelText(/Владелец: ФИО/), 'Азиз Каримов');
  await userEvent.type(screen.getByLabelText(/Владелец: email/), 'aziz@plov.uz');
  await userEvent.type(screen.getByLabelText(/временный пароль/), 'Start1234');
}

describe('CreateOrganizationModal', () => {
  it('validates required fields, slug, currency and password policy', async () => {
    server.use(http.get(api('/platform/plans'), () => HttpResponse.json(plans)));
    renderWithProviders(<CreateOrganizationModal open onClose={vi.fn()} />, { auth: platformAdmin });

    await userEvent.click(screen.getByRole('button', { name: 'Создать организацию' }));
    expect((await screen.findAllByText('Обязательное поле')).length).toBeGreaterThanOrEqual(5);

    await userEvent.type(screen.getByLabelText(/Slug/), 'Bad Slug!');
    const currency = screen.getByLabelText(/Валюта/);
    await userEvent.clear(currency);
    await userEvent.type(currency, 'us');
    await userEvent.type(screen.getByLabelText(/временный пароль/), 'short');
    await userEvent.click(screen.getByRole('button', { name: 'Создать организацию' }));
    expect(await screen.findByText('Только латинские строчные буквы, цифры и дефис')).toBeInTheDocument();
    expect(screen.getByText(/3 заглавных латинских букв/)).toBeInTheDocument();
    expect(screen.getByText(/Минимум 8 символов/)).toBeInTheDocument();
  });

  it('suggests a slug, submits the contract body and maps the slug_taken code to the slug field', async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.get(api('/platform/plans'), () => HttpResponse.json(plans)),
      http.post(api('/platform/organizations'), async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return problem(409, 'organization.slug_taken');
      }),
    );
    const onClose = vi.fn();
    renderWithProviders(<CreateOrganizationModal open onClose={onClose} />, { auth: platformAdmin });
    await screen.findByRole('option', { name: 'Business' });
    await fillValid();
    expect(screen.getByLabelText(/Slug/)).toHaveValue('chayxona-plov');

    await userEvent.click(screen.getByRole('button', { name: 'Создать организацию' }));
    expect(await screen.findByText('Такой slug уже занят.')).toBeInTheDocument();
    await waitFor(() =>
      expect(body).toEqual({
        name: 'Chayxona Plov',
        slug: 'chayxona-plov',
        currency: 'UZS',
        branchName: 'Центр',
        planCode: 'business',
        ownerFullName: 'Азиз Каримов',
        ownerEmail: 'aziz@plov.uz',
        ownerPassword: 'Start1234',
      }),
    );
    expect(onClose).not.toHaveBeenCalled();
  });
});
