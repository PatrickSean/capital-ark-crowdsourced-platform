import Image from "next/image";

export default function EmbedDriveNotFound() {
  return (
    <main className="mx-auto w-full max-w-[760px] p-2 min-[400px]:p-3">
      <section className="rounded-[1.375rem] bg-white p-6 text-center shadow-card ring-1 ring-ink-100">
        <BrandLockup />
        <h1 className="mt-6 text-xl font-bold tracking-tight text-ink-900">
          This drive isn&rsquo;t available
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-600">
          It may be unpublished or the link may have changed. Ask the website
          owner for an updated Capital Ark embed.
        </p>
      </section>
    </main>
  );
}

function BrandLockup() {
  return (
    <div className="flex items-center justify-center gap-2.5 text-sm font-bold text-ink-900">
      <Image
        src="/icons/capital-ark-192.png"
        alt=""
        width={32}
        height={32}
        sizes="32px"
        className="size-8 rounded-[0.65rem]"
      />
      Capital Ark
    </div>
  );
}
