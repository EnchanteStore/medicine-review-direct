import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Alert, Button, CheckboxField, ErrorSummary, FormField, Input } from '../src';

describe('Button', () => {
  it('defaults to type="button" so it never submits forms by accident', () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole('button', { name: 'Go' })).toHaveAttribute('type', 'button');
  });

  it('renders as a link with asChild', () => {
    render(
      <Button asChild>
        <a href="/pricing">Pricing</a>
      </Button>,
    );
    const link = screen.getByRole('link', { name: 'Pricing' });
    expect(link).toHaveAttribute('href', '/pricing');
    expect(link).not.toHaveAttribute('type');
  });
});

describe('FormField', () => {
  it('associates label, hint and error with the input', () => {
    render(
      <FormField
        id="email"
        label="Email address"
        hint="We'll send a link"
        errors={['Enter an email']}
      >
        {(aria) => <Input {...aria} />}
      </FormField>,
    );
    const input = screen.getByLabelText('Email address');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription(/We'll send a link.*Enter an email/);
  });

  it('omits aria-invalid when there is no error', () => {
    render(
      <FormField id="name" label="Name">
        {(aria) => <Input {...aria} />}
      </FormField>,
    );
    expect(screen.getByLabelText('Name')).not.toHaveAttribute('aria-invalid');
  });
});

describe('CheckboxField', () => {
  it('is labelled and reports errors', () => {
    render(<CheckboxField id="adult" name="adult" label="I am 18 or over" errors={['Required']} />);
    const box = screen.getByRole('checkbox', { name: 'I am 18 or over' });
    expect(box).toHaveAccessibleDescription(/Required/);
  });
});

describe('Alert and ErrorSummary', () => {
  it('uses role=alert for danger and role=status otherwise', () => {
    render(
      <>
        <Alert tone="danger">Bad</Alert>
        <Alert tone="info">Fyi</Alert>
      </>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Bad');
    expect(screen.getByRole('status')).toHaveTextContent('Fyi');
  });

  it('links each error to its field and takes focus', () => {
    render(<ErrorSummary errors={[{ field: 'email', message: 'Enter your email address' }]} />);
    expect(screen.getByRole('link', { name: 'Enter your email address' })).toHaveAttribute(
      'href',
      '#email',
    );
    expect(screen.getByRole('alert')).toHaveFocus();
  });

  it('renders nothing with no errors', () => {
    const { container } = render(<ErrorSummary errors={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
