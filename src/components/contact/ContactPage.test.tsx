// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { about } from '@content/about';
import ContactPage, { metadata } from '@/app/contact/page';
import { siteConfig } from '@/config/site';

describe('/contact page', () => {
  it('has one h1, the creator card, the links and the contact form', () => {
    render(<ContactPage />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Say hello');

    const card = screen.getByRole('article', { name: about.name });
    expect(
      within(card).getByText(about.avatarInitials).closest('[aria-hidden="true"]'),
    ).not.toBeNull();
    for (const paragraph of about.bio)
      expect(within(card).getByText(paragraph)).toBeInTheDocument();

    const github = within(card).getByRole('link', { name: 'GitHub profile (opens in a new tab)' });
    expect(github).toHaveAttribute('href', siteConfig.creator.githubUrl);
    expect(github).toHaveAttribute('target', '_blank');
    expect(github).toHaveAttribute('rel', 'noopener noreferrer');

    const mail = within(card).getByRole('link', { name: `Email ${siteConfig.creator.email}` });
    expect(mail).toHaveAttribute('href', `mailto:${siteConfig.creator.email}`);
    expect(within(card).getByRole('button', { name: 'Copy email' })).toBeInTheDocument();

    const form = screen.getByRole('region', { name: 'Send a message' });
    expect(within(form).getByRole('textbox', { name: 'Your name' })).toBeRequired();
    expect(within(form).getByRole('textbox', { name: 'Your email' })).toBeRequired();
    expect(within(form).getByRole('textbox', { name: 'Message' })).toBeRequired();
    expect(within(form).getByRole('link', { name: 'Community Board' })).toHaveAttribute(
      'href',
      '/community',
    );
  });

  it('exports canonical metadata', () => {
    expect(metadata.title).toBe('Contact');
    expect(metadata.alternates?.canonical).toBe('/contact');
    expect(String(metadata.description)).toMatch(/creator/i);
  });
});
