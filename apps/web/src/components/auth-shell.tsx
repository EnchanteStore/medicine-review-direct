import { Card, Container } from '@mrd/ui';

export function AuthShell({
  title,
  lead,
  children,
  aside,
}: {
  title: string;
  lead?: React.ReactNode;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <Container className="py-10 sm:py-14">
      <div className="mx-auto max-w-xl">
        <h1 className="font-serif text-3xl sm:text-4xl">{title}</h1>
        {lead ? <div className="mt-3 text-lg text-ink-700">{lead}</div> : null}
        <Card className="mt-8">{children}</Card>
        {aside ? <div className="mt-6">{aside}</div> : null}
      </div>
    </Container>
  );
}
