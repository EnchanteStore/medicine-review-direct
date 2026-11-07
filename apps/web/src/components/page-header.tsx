import { Container } from '@mrd/ui';

export function PageHeader({ title, lead }: { title: string; lead?: React.ReactNode }) {
  return (
    <div className="border-b border-sand-200 bg-teal-50">
      <Container className="py-10 sm:py-14">
        <h1 className="font-serif text-3xl sm:text-4xl">{title}</h1>
        {lead ? <p className="mt-4 max-w-2xl text-lg text-ink-700">{lead}</p> : null}
      </Container>
    </div>
  );
}

export function ContentPage({
  title,
  lead,
  children,
}: {
  title: string;
  lead?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <>
      <PageHeader title={title} lead={lead} />
      <Container className="py-10">
        <div className="prose-mrd">{children}</div>
      </Container>
    </>
  );
}
