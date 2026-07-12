"use client";

import Image from "next/image";
import QRCode from "qrcode";
import {
  AlertCircle,
  Download,
  LoaderCircle,
  Printer,
  QrCode,
  Share2,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { isLoyaltyToken } from "@/components/loyalty/qr-scanner";
import type { IssuedCard } from "@/lib/data/types";
import { cn } from "@/lib/utils";

export type LoyaltyCardProps = {
  issuedCard: IssuedCard;
  storeName: string;
  className?: string;
};

function safeFileName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function fitCanvasText(
  context: CanvasRenderingContext2D,
  value: string,
  maxWidth: number,
) {
  if (context.measureText(value).width <= maxWidth) return value;

  let shortened = value;
  while (shortened.length > 1) {
    shortened = shortened.slice(0, -1);
    if (context.measureText(`${shortened}…`).width <= maxWidth) {
      return `${shortened}…`;
    }
  }

  return "…";
}

function loadQrImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to prepare the QR image."));
    image.src = source;
  });
}

async function createCardPng(
  qrDataUrl: string,
  issuedCard: IssuedCard,
  storeName: string,
) {
  const canvas = document.createElement("canvas");
  canvas.width = 900;
  canvas.height = 1_200;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Card export is not supported by this browser.");

  context.fillStyle = "#052e24";
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = "#34d399";
  context.beginPath();
  context.arc(760, 95, 180, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#ffffff";
  context.font = "700 38px system-ui, sans-serif";
  context.fillText(fitCanvasText(context, storeName, 650), 72, 100);
  context.font = "500 22px system-ui, sans-serif";
  context.fillStyle = "#a7f3d0";
  context.fillText("LOYALTY MEMBER", 72, 145);

  context.fillStyle = "#ffffff";
  context.font = "700 54px system-ui, sans-serif";
  context.fillText(
    fitCanvasText(context, issuedCard.member.fullName, 756),
    72,
    225,
  );
  context.font = "600 26px ui-monospace, monospace";
  context.fillStyle = "#d1fae5";
  context.fillText(issuedCard.member.memberCode, 72, 272);

  context.fillStyle = "#ffffff";
  context.beginPath();
  context.roundRect(72, 320, 756, 756, 40);
  context.fill();

  const qrImage = await loadQrImage(qrDataUrl);
  context.drawImage(qrImage, 132, 380, 636, 636);

  context.fillStyle = "#d1fae5";
  context.font = "500 23px system-ui, sans-serif";
  context.textAlign = "center";
  context.fillText("Present this code to staff when you visit", 450, 1_135);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("The loyalty card could not be exported."));
    }, "image/png");
  });
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function LoyaltyCard({
  issuedCard,
  storeName,
  className,
}: LoyaltyCardProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<"share" | "download" | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!isLoyaltyToken(issuedCard.token)) {
      return;
    }

    QRCode.toDataURL(issuedCard.token, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 512,
      color: {
        dark: "#052e24",
        light: "#ffffff",
      },
    })
      .then((dataUrl) => {
        if (!cancelled) {
          setQrToken(issuedCard.token);
          setQrDataUrl(dataUrl);
          setQrError(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQrToken(issuedCard.token);
          setQrDataUrl(null);
          setQrError("The QR code could not be created. Try reissuing the card.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [issuedCard.token]);

  const cardFileName = `${safeFileName(issuedCard.member.memberCode) || "loyalty-card"}.png`;
  const tokenIsValid = isLoyaltyToken(issuedCard.token);
  const currentQrDataUrl = qrToken === issuedCard.token ? qrDataUrl : null;
  const currentQrError = !tokenIsValid
    ? "This loyalty ID is not valid. Reissue the card before sharing it."
    : qrToken === issuedCard.token
      ? qrError
      : null;
  const actionsDisabled = !currentQrDataUrl || Boolean(currentQrError) || busyAction !== null;

  const downloadCard = async () => {
    if (!currentQrDataUrl) return;
    setBusyAction("download");
    setActionMessage(null);

    try {
      const blob = await createCardPng(currentQrDataUrl, issuedCard, storeName);
      downloadBlob(blob, cardFileName);
      setActionMessage("Loyalty card downloaded.");
    } catch {
      setActionMessage("The card could not be downloaded. Please try again.");
    } finally {
      setBusyAction(null);
    }
  };

  const shareCard = async () => {
    if (!currentQrDataUrl) return;
    setBusyAction("share");
    setActionMessage(null);

    try {
      const blob = await createCardPng(currentQrDataUrl, issuedCard, storeName);
      const file = new File([blob], cardFileName, { type: "image/png" });
      const shareData = {
        title: `${storeName} loyalty card`,
        text: `${issuedCard.member.fullName}'s ${storeName} loyalty card`,
        files: [file],
      };

      if (navigator.share && navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
        setActionMessage("Loyalty card shared.");
      } else {
        downloadBlob(blob, cardFileName);
        setActionMessage(
          "Sharing is not available here, so the loyalty card was downloaded instead.",
        );
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setActionMessage("The card could not be shared. Please try again.");
    } finally {
      setBusyAction(null);
    }
  };

  const printCard = () => {
    if (!currentQrDataUrl) return;
    setActionMessage(null);

    const printWindow = window.open(
      "",
      "loyalty-card-print",
      "popup,width=520,height=760",
    );
    if (!printWindow) {
      setActionMessage("Allow pop-ups for this site to print the loyalty card.");
      return;
    }

    printWindow.opener = null;
    const document = printWindow.document;
    document.open();
    document.title = `${issuedCard.member.memberCode} loyalty card`;

    const style = document.createElement("style");
    style.textContent = `
      * { box-sizing: border-box; }
      body { margin: 0; padding: 24px; background: white; font-family: system-ui, sans-serif; }
      main { width: 360px; margin: 0 auto; border-radius: 24px; overflow: hidden; background: #052e24; color: white; padding: 28px; }
      .store { margin: 0 0 6px; font-size: 20px; font-weight: 750; }
      .label { margin: 0 0 24px; color: #a7f3d0; font-size: 11px; font-weight: 700; letter-spacing: .14em; }
      h1 { margin: 0; font-size: 28px; line-height: 1.1; }
      .code { margin: 7px 0 22px; color: #d1fae5; font: 600 14px ui-monospace, monospace; }
      img { display: block; width: 100%; height: auto; border-radius: 16px; background: white; }
      .help { margin: 18px 0 0; color: #d1fae5; font-size: 12px; text-align: center; }
      @page { margin: 12mm; }
    `;
    document.head.append(style);

    const card = document.createElement("main");
    const store = document.createElement("p");
    store.className = "store";
    store.textContent = storeName;
    const label = document.createElement("p");
    label.className = "label";
    label.textContent = "LOYALTY MEMBER";
    const name = document.createElement("h1");
    name.textContent = issuedCard.member.fullName;
    const code = document.createElement("p");
    code.className = "code";
    code.textContent = issuedCard.member.memberCode;
    const qrImage = document.createElement("img");
    qrImage.alt = "Customer loyalty QR code";
    const help = document.createElement("p");
    help.className = "help";
    help.textContent = "Present this code to staff when you visit";

    card.append(store, label, name, code, qrImage, help);
    document.body.append(card);
    qrImage.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
    qrImage.src = currentQrDataUrl;
    document.close();
  };

  return (
    <div className={cn("space-y-4", className)}>
      <Card className="relative overflow-hidden border-0 bg-[#052e24] text-white shadow-xl ring-0">
        <div
          aria-hidden="true"
          className="absolute -right-12 -top-14 size-44 rounded-full bg-emerald-400/90"
        />
        <CardContent className="relative space-y-5 p-5 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="truncate text-lg font-bold">{storeName}</p>
              <p className="mt-1 text-xs font-semibold tracking-[0.16em] text-emerald-200">
                LOYALTY MEMBER
              </p>
            </div>
            <Badge className="shrink-0 bg-white/15 text-white ring-1 ring-white/20">
              <QrCode /> Digital ID
            </Badge>
          </div>

          <div>
            <p className="truncate text-2xl font-bold sm:text-3xl">
              {issuedCard.member.fullName}
            </p>
            <p className="mt-1 font-mono text-sm font-semibold text-emerald-100">
              {issuedCard.member.memberCode}
            </p>
          </div>

          <div className="mx-auto flex aspect-square w-full max-w-sm items-center justify-center overflow-hidden rounded-3xl bg-white p-4 shadow-inner">
            {!currentQrDataUrl && !currentQrError ? (
              <div
                role="status"
                className="flex flex-col items-center gap-3 text-sm font-medium text-slate-700"
              >
                <LoaderCircle className="size-8 animate-spin text-emerald-700" />
                Creating secure QR code…
              </div>
            ) : null}
            {currentQrDataUrl ? (
              <Image
                src={currentQrDataUrl}
                alt={`${issuedCard.member.fullName}'s loyalty QR code`}
                width={512}
                height={512}
                unoptimized
                className="h-full w-full"
              />
            ) : null}
            {currentQrError ? (
              <div
                role="alert"
                className="p-6 text-center text-sm font-medium text-destructive"
              >
                <AlertCircle className="mx-auto mb-3 size-9" />
                {currentQrError}
              </div>
            ) : null}
          </div>

          <p className="text-center text-sm text-emerald-100">
            Present this code to staff when you visit
          </p>
        </CardContent>
      </Card>

      {currentQrError ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Card unavailable</AlertTitle>
          <AlertDescription>{currentQrError}</AlertDescription>
        </Alert>
      ) : null}

      <div
        data-print-hidden="true"
        className="grid grid-cols-1 gap-2 sm:grid-cols-3"
      >
        <Button
          type="button"
          size="lg"
          onClick={() => void shareCard()}
          disabled={actionsDisabled}
          className="h-11"
        >
          {busyAction === "share" ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <Share2 />
          )}
          Share
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => void downloadCard()}
          disabled={actionsDisabled}
          className="h-11"
        >
          {busyAction === "download" ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <Download />
          )}
          Download
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={printCard}
          disabled={actionsDisabled}
          className="h-11"
        >
          <Printer />
          Print
        </Button>
      </div>

      <p aria-live="polite" className="min-h-5 text-sm text-muted-foreground">
        {actionMessage}
      </p>
    </div>
  );
}
