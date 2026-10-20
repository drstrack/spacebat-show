export function SystemMessage({ body }: { body: string }) {
  return (
    <div className="flex justify-center">
      <p className="inline-block max-w-full border-[3px] border-ink bg-crimson px-3 py-1 text-center font-display text-sm tracking-wide text-crimson-fg">
        {body}
      </p>
    </div>
  );
}
