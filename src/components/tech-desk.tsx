import { upload } from "@vercel/blob/client";
import { useRouter } from "@tanstack/react-router";
import { useRef, useState, type FormEvent } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getBearerToken } from "@/lib/auth/client";
import { classifyUpload } from "@/lib/chat/uploads";
import {
  parseImageUrl,
  safeImageUrl,
  safeProductUrl,
  swappedSortOrders,
  techBlobPathname,
  techHostLabel,
  type TechHost,
  type TechImageSource,
  type TechProduct,
} from "@/lib/tech/products";
import { deleteTech, previewTechLink, saveTech } from "@/lib/tech/products.functions";

type FormState = {
  id: string;
  name: string;
  description: string;
  productUrl: string;
  imageSource: TechImageSource;
  customImageUrl: string;
  autoImageUrl: string;
  pasteUrl: string;
  recommendedBy: "" | TechHost;
  sortOrder: string;
};

function emptyForm(viewerHost: "john" | "dan" | null): FormState {
  return {
    id: "",
    name: "",
    description: "",
    productUrl: "",
    imageSource: "auto",
    customImageUrl: "",
    autoImageUrl: "",
    pasteUrl: "",
    recommendedBy: viewerHost ?? "",
    sortOrder: "",
  };
}

function savePayload(product: TechProduct, sortOrder: number) {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    productUrl: product.productUrl,
    imageSource: product.imageSource,
    customImageUrl: product.imageSource === "custom" ? (product.imageUrl ?? "") : "",
    recommendedBy: product.recommendedBy,
    sortOrder,
  };
}

function errorText(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

function typeFromName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

export function TechEmpty({ canManage }: { canManage: boolean }) {
  return (
    <div className="panel bg-paper px-6 py-10 text-center">
      <p className="font-display text-4xl tracking-wide">Nothing on the bench yet.</p>
      <p className="mx-auto mt-3 max-w-md text-base leading-relaxed text-muted">
        {canManage
          ? "Add a product you use. Visitors only see the list."
          : "John and Dan haven't posted the tech they use yet. Check back after the next show."}
      </p>
    </div>
  );
}

export function TechGrid({
  products,
  onEdit,
  onDelete,
  onMove,
  controlsDisabled = false,
}: {
  products: readonly TechProduct[];
  onEdit?: (product: TechProduct) => void;
  onDelete?: (product: TechProduct) => void;
  onMove?: (product: TechProduct, direction: "earlier" | "later") => void;
  controlsDisabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {products.map((product, index) => (
        <TechCard
          key={product.id}
          product={product}
          onEdit={onEdit}
          onDelete={onDelete}
          onMove={onMove}
          canMoveEarlier={index > 0}
          canMoveLater={index < products.length - 1}
          controlsDisabled={controlsDisabled}
        />
      ))}
    </div>
  );
}

function TechCard({
  product,
  onEdit,
  onDelete,
  onMove,
  canMoveEarlier,
  canMoveLater,
  controlsDisabled,
}: {
  product: TechProduct;
  onEdit?: (product: TechProduct) => void;
  onDelete?: (product: TechProduct) => void;
  onMove?: (product: TechProduct, direction: "earlier" | "later") => void;
  canMoveEarlier?: boolean;
  canMoveLater?: boolean;
  controlsDisabled?: boolean;
}) {
  const href = safeProductUrl(product.productUrl);
  const host = techHostLabel(product.recommendedBy);
  return (
    <article className="panel flex flex-col overflow-hidden bg-paper">
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crimson focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
          aria-label={`${product.name}, opens in a new tab`}
        >
          <TechShot src={safeImageUrl(product.imageUrl)} />
        </a>
      ) : (
        <TechShot src={safeImageUrl(product.imageUrl)} />
      )}
      <div className="flex flex-1 flex-col gap-3 p-4">
        {host ? <span className="caption-box w-fit text-sm">{host}</span> : null}
        <h2 className="font-display text-3xl leading-none tracking-wide">{product.name}</h2>
        {product.description ? (
          <p className="text-sm leading-relaxed text-muted">{product.description}</p>
        ) : null}
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-auto font-display text-xl tracking-wide text-crimson hover:underline"
          >
            See the product
          </a>
        ) : null}
        {onEdit && onDelete ? (
          <div className="flex flex-wrap gap-2">
            {onMove ? (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={controlsDisabled || !canMoveEarlier}
                  onClick={() => onMove(product, "earlier")}
                >
                  Move up
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={controlsDisabled || !canMoveLater}
                  onClick={() => onMove(product, "later")}
                >
                  Move down
                </Button>
              </>
            ) : null}
            <Button type="button" variant="secondary" size="sm" disabled={controlsDisabled} onClick={() => onEdit(product)}>
              Edit
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={controlsDisabled} onClick={() => onDelete(product)}>
              Delete
            </Button>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function TechShot({ src }: { src: string | null }) {
  return <TechShotInner key={src ?? "empty"} src={src} />;
}

function TechShotInner({ src }: { src: string | null }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="flex aspect-[4/3] items-center justify-center bg-ivory">
      {src && !failed ? (
        <img
          src={src}
          alt=""
          className="h-full w-full object-contain"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="px-4 text-center font-display text-2xl tracking-wide text-faint">No picture yet</span>
      )}
    </div>
  );
}

export function TechDesk({
  products,
  viewerHost,
}: {
  products: readonly TechProduct[];
  viewerHost: "john" | "dan" | null;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<FormState>(() => emptyForm(viewerHost));
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [pending, setPending] = useState<TechProduct | null>(null);
  const lookedUp = useRef("");
  const lookupLock = useRef(false);

  function startAdd() {
    setError("");
    setForm(emptyForm(viewerHost));
    lookedUp.current = "";
    setOpen(true);
    requestAnimationFrame(() => document.getElementById("tech-product-url")?.focus());
  }

  function startEdit(product: TechProduct) {
    setError("");
    setForm({
      id: product.id,
      name: product.name,
      description: product.description,
      productUrl: product.productUrl,
      imageSource: product.imageSource,
      customImageUrl: product.imageSource === "custom" ? (product.imageUrl ?? "") : "",
      autoImageUrl: product.autoImageUrl ?? "",
      pasteUrl: "",
      recommendedBy: product.recommendedBy ?? "",
      sortOrder: String(product.sortOrder),
    });
    lookedUp.current = product.productUrl;
    setOpen(true);
    requestAnimationFrame(() => {
      document.getElementById("tech-form")?.scrollIntoView({ block: "start" });
      document.getElementById("tech-product-url")?.focus();
    });
  }

  async function lookUp(url: string) {
    const trimmed = url.trim();
    if (!trimmed || trimmed === lookedUp.current || lookupLock.current) return;
    lookupLock.current = true;
    setBusy("lookup");
    setError("");
    try {
      const result = await previewTechLink({ data: { url: trimmed } });
      lookedUp.current = trimmed;
      setForm((current) => ({
        ...current,
        name: current.name.trim() ? current.name : result.name,
        description: current.description.trim() ? current.description : result.description,
        autoImageUrl: result.autoImageUrl ?? "",
      }));
    } catch (err) {
      setError(errorText(err, "Couldn't read that page."));
    } finally {
      lookupLock.current = false;
      setBusy("");
    }
  }

  async function onSave(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy("save");
    try {
      const sort = form.sortOrder.trim();
      await saveTech({
        data: {
          id: form.id || undefined,
          name: form.name,
          description: form.description,
          productUrl: form.productUrl,
          imageSource: form.imageSource,
          customImageUrl: form.imageSource === "custom" ? form.customImageUrl : "",
          recommendedBy: form.recommendedBy || null,
          sortOrder: sort === "" ? null : Number(sort),
        },
      });
      setOpen(false);
      setForm(emptyForm(viewerHost));
      await router.invalidate();
    } catch (err) {
      setError(errorText(err, "That didn't save."));
    } finally {
      setBusy("");
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError("");
    const classified = classifyUpload(file.name, file.type || typeFromName(file.name), file.size);
    if (!classified.ok || classified.kind !== "image") {
      setError(classified.ok ? "That file type isn't allowed." : classified.error);
      return;
    }
    setBusy("upload");
    try {
      const token = getBearerToken();
      const blob = await upload(techBlobPathname(file.name), file, {
        access: "public",
        handleUploadUrl: "/api/tech/upload",
        contentType: classified.contentType,
        clientPayload: JSON.stringify({ name: file.name, type: file.type, size: file.size }),
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      setForm((current) => ({ ...current, imageSource: "custom", customImageUrl: blob.url }));
    } catch (err) {
      setError(errorText(err, "Couldn't upload that picture. Paste an image URL instead."));
    } finally {
      setBusy("");
    }
  }

  function usePasted() {
    const image = parseImageUrl(form.pasteUrl);
    if (typeof image !== "string") {
      setError(image.error);
      return;
    }
    setError("");
    setForm((current) => ({ ...current, imageSource: "custom", customImageUrl: image, pasteUrl: "" }));
  }

  const preview =
    form.imageSource === "custom" && form.customImageUrl
      ? safeImageUrl(form.customImageUrl)
      : safeImageUrl(form.autoImageUrl);

  async function move(product: TechProduct, direction: "earlier" | "later") {
    const index = products.findIndex((row) => row.id === product.id);
    const neighbor = products[direction === "earlier" ? index - 1 : index + 1];
    if (!neighbor || index < 0) return;
    const next = swappedSortOrders(product.sortOrder, neighbor.sortOrder, direction);
    setError("");
    setBusy("move");
    try {
      await saveTech({ data: savePayload(neighbor, next.neighbor) });
      await saveTech({ data: savePayload(product, next.current) });
      await router.invalidate();
    } catch (err) {
      setError(errorText(err, "That didn't move."));
    } finally {
      setBusy("");
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={startAdd}>
          Add product
        </Button>
      </div>

      {error && !open ? <p className="mt-3 text-sm text-crimson">{error}</p> : null}

      {open ? (
        <form id="tech-form" className="panel mt-4 bg-paper p-4 sm:p-6" onSubmit={onSave}>
          <h2 className="font-display text-4xl tracking-wide">{form.id ? "Edit product" : "Add a product"}</h2>
          <div className="mt-4 grid gap-4">
            <label className="grid gap-2 text-sm font-medium">
              Product link
              <Input
                id="tech-product-url"
                value={form.productUrl}
                inputMode="url"
                autoComplete="off"
                placeholder="https://"
                onChange={(event) => setForm((current) => ({ ...current, productUrl: event.target.value }))}
                onBlur={() => void lookUp(form.productUrl)}
                required
              />
            </label>
            <div>
              <Button type="button" variant="secondary" disabled={busy !== ""} onClick={() => void lookUp(form.productUrl)}>
                {busy === "lookup" ? "Looking up" : "Find picture"}
              </Button>
            </div>
            <label className="grid gap-2 text-sm font-medium">
              Name
              <Input
                value={form.name}
                maxLength={120}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                required
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Description
              <textarea
                value={form.description}
                maxLength={2000}
                rows={4}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                className="w-full rounded-xs border-4 border-ink bg-ivory px-4 py-3 text-base text-ink shadow-[4px_4px_0_0_var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crimson"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Recommended by
              <select
                value={form.recommendedBy}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    recommendedBy: event.target.value as FormState["recommendedBy"],
                  }))
                }
                className="h-12 w-full rounded-xs border-4 border-ink bg-ivory px-4 text-base text-ink shadow-[4px_4px_0_0_var(--color-ink)]"
              >
                <option value="">Not specified</option>
                <option value="john">John</option>
                <option value="dan">Dan</option>
                <option value="both">John and Dan</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Sort order
              <Input
                value={form.sortOrder}
                inputMode="numeric"
                placeholder="Lower numbers show first"
                onChange={(event) => setForm((current) => ({ ...current, sortOrder: event.target.value }))}
              />
            </label>
            <div>
              <p className="text-sm font-medium">Picture</p>
              <div className="mt-2 max-w-sm overflow-hidden border-4 border-ink bg-ivory">
                <TechShot src={preview} />
              </div>
              <p className="mt-2 text-sm text-muted">
                {form.imageSource === "custom"
                  ? "Showing your picture. A new link won't replace it."
                  : form.autoImageUrl
                    ? "Showing the picture from the product page."
                    : "No picture on that page yet. Upload one, or paste an image URL."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" variant="secondary" disabled={busy !== ""} onClick={() => fileRef.current?.click()}>
                  {busy === "upload" ? "Uploading" : "Upload picture"}
                </Button>
                {form.autoImageUrl && form.imageSource === "custom" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setForm((current) => ({ ...current, imageSource: "auto" }))}
                  >
                    Use the automatic picture
                  </Button>
                ) : null}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  void onFile(file);
                }}
              />
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Input
                  value={form.pasteUrl}
                  inputMode="url"
                  placeholder="Or paste an image URL"
                  aria-label="Image URL"
                  onChange={(event) => setForm((current) => ({ ...current, pasteUrl: event.target.value }))}
                />
                <Button type="button" variant="ghost" className="shrink-0" onClick={usePasted}>
                  Use this picture
                </Button>
              </div>
            </div>
          </div>
          {error ? <p className="mt-4 text-sm text-crimson">{error}</p> : null}
          <div className="mt-5 flex flex-wrap gap-2">
            <Button type="submit" disabled={busy !== ""}>
              {busy === "save" ? "Saving" : "Save product"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}

      <div className="py-6">
        {products.length === 0 ? (
          <TechEmpty canManage />
        ) : (
          <TechGrid
            products={products}
            onEdit={startEdit}
            onDelete={setPending}
            onMove={(product, direction) => void move(product, direction)}
            controlsDisabled={busy !== ""}
          />
        )}
      </div>

      <ConfirmDialog
        open={pending != null}
        description={pending ? `Delete ${pending.name}? It leaves the page for everyone.` : ""}
        confirmLabel="Delete"
        pending={busy === "delete"}
        pendingLabel="Deleting"
        onOpenChange={(next) => {
          if (!next) setPending(null);
        }}
        onConfirm={() => {
          if (!pending) return;
          setBusy("delete");
          void deleteTech({ data: { id: pending.id } })
            .then(() => router.invalidate())
            .then(() => setPending(null))
            .catch((err: unknown) => setError(errorText(err, "That didn't delete.")))
            .finally(() => setBusy(""));
        }}
      />
    </div>
  );
}
