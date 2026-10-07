"use client";

import React, { useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export default function ExtractionDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  useEffect(() => {
    if (id) {
      router.replace(`/patient/documents/${id}`);
    }
  }, [id, router]);

  return (
    <div className="min-h-screen bg-[#f4f7f6] flex flex-col items-center justify-center p-4">
      <RefreshCw className="w-8 h-8 animate-spin mx-auto text-[#008080] mb-3" />
      <h2 className="text-sm font-bold text-slate-700">
        Redirecting to patient medical document record #{id}...
      </h2>
    </div>
  );
}
