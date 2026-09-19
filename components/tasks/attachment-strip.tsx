"use client";
import { useState } from "react";
import * as D from "@radix-ui/react-dialog";
import { Download, FileText, Play, X } from "lucide-react";
import { previewType } from "@/lib/attachment-preview";
type Attachment = { id: string; name: string; size?: number };
export function AttachmentStrip({
  attachments,
}: {
  attachments: Attachment[];
}) {
  const [selected, setSelected] = useState<Attachment | null>(null);
  const type = selected ? previewType(selected.name) : null;
  const url = (a: Attachment) => "/api/attachments/" + a.id;
  return (
    <>
      <div
        className="attachment-strip"
        role="list"
        aria-label="Update attachments"
      >
        {attachments.map((a) => {
          const mime = previewType(a.name);
          return (
            <div role="listitem" key={a.id} className="attachment-tile">
              {mime ? (
                <button
                  type="button"
                  onClick={() => setSelected(a)}
                  aria-label={"Preview " + a.name}
                  title={a.name}
                >
                  <Thumbnail attachment={a} />
                  <span className="attachment-caption">{a.name}</span>
                </button>
              ) : (
                <a
                  href={url(a)}
                  aria-label={"Download " + a.name}
                  title={a.name}
                >
                  <FileText size={32} />
                  <span className="attachment-caption">{a.name}</span>
                </a>
              )}
            </div>
          );
        })}
      </div>
      <D.Root
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <D.Portal>
          <D.Overlay className="fixed inset-0 z-50 bg-black/60" />
          <D.Content className="attachment-preview-dialog">
            <D.Title className="pr-10 text-base font-semibold break-all">
              {selected?.name}
            </D.Title>
            <D.Description className="sr-only">
              Attachment preview. Download the file if your browser cannot
              display this format.
            </D.Description>
            <D.Close
              className="absolute right-4 top-4 rounded p-1"
              aria-label="Close preview"
            >
              <X size={20} />
            </D.Close>
            {selected && (
              <>
                <div className="attachment-preview-body">
                  {type?.startsWith("image/") ? (
                    <img
                      src={url(selected) + "?preview=1"}
                      alt={selected.name}
                    />
                  ) : type?.startsWith("video/") ? (
                    <video
                      key={selected.id}
                      src={url(selected) + "?preview=1"}
                      controls
                      playsInline
                      preload="metadata"
                    />
                  ) : (
                    <iframe
                      key={selected.id}
                      src={url(selected) + "?preview=1"}
                      title={selected.name}
                    />
                  )}
                </div>
                <a
                  className="inline-flex items-center gap-2 text-sm text-emerald-700"
                  href={url(selected)}
                >
                  <Download size={16} />
                  Download original
                </a>
                <p className="mt-2 text-xs text-stone-500">
                  If the preview is unavailable in your browser, download the
                  original file.
                </p>
              </>
            )}
          </D.Content>
        </D.Portal>
      </D.Root>
    </>
  );
}
function Thumbnail({ attachment: a }: { attachment: Attachment }) {
  const [failed, setFailed] = useState(false);
  const mime = previewType(a.name);
  const url = "/api/attachments/" + a.id + "?preview=1";
  if (failed) return <FileText size={32} />;
  if (mime?.startsWith("image/"))
    return (
      <img src={url} alt="" loading="lazy" onError={() => setFailed(true)} />
    );
  if (mime?.startsWith("video/"))
    return (
      <>
        <video
          src={url + "#t=0.1"}
          muted
          playsInline
          preload="metadata"
          onError={() => setFailed(true)}
        />
        <Play className="video-play" size={24} />
      </>
    );
  return (
    <div className="pdf-thumbnail">
      <FileText size={34} />
      <strong>PDF</strong>
    </div>
  );
}
