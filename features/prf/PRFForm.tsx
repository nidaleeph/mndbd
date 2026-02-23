"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Textarea, Select } from "@/components/ui";
import { prfSchema, type PRFFormData } from "@/schemas/prf";

/** Form state uses string for date (HTML input type="date" format) */
type PRFFormState = Omit<PRFFormData, "requestDate"> & { requestDate: string };
import type { SelectOption } from "@/components/ui/Select";

const STATUS_OPTIONS_CREATOR: SelectOption[] = [
  { value: "draft", label: "Draft" },
  { value: "pending", label: "Pending" },
];

const STATUS_OPTIONS_APPROVER: SelectOption[] = [
  { value: "draft", label: "Draft" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

export function PRFForm({ prfId, canApprove = false }: { prfId?: string; canApprove?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ministries, setMinistries] = useState<SelectOption[]>([]);
  const [formData, setFormData] = useState<PRFFormState>({
    ministryId: "",
    requestDate: new Date().toISOString().slice(0, 10),
    amountRequested: 0,
    purpose: "",
    justification: "",
    status: "draft",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof PRFFormData, string>>>({});

  useEffect(() => {
    const url = prfId ? "/api/options/ministries" : "/api/options/ministries?context=user-create";
    fetch(url)
      .then((r) => r.json())
      .then((data: { id: string; name: string }[]) =>
        setMinistries(data.map((m) => ({ value: m.id, label: m.name })))
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!prfId) return;
    fetch(`/api/forms/prf/${prfId}`)
      .then((r) => r.json())
      .then((data: PRFFormState) => {
        setFormData({
          ministryId: data.ministryId,
          requestDate: data.requestDate?.slice(0, 10) ?? "",
          amountRequested: Number(data.amountRequested) ?? 0,
          purpose: data.purpose,
          justification: data.justification,
          status: data.status ?? "draft",
        });
      })
      .catch(() => setError("Failed to load PRF"));
  }, [prfId, setFormData, setError]);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "amountRequested" ? Number(value) || 0 : value,
    }));
    if (errors[name as keyof PRFFormData]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>, submitForApproval = false) {
    e.preventDefault();
    setError(null);
    const parsed = prfSchema.safeParse({
      ...formData,
      requestDate: new Date(formData.requestDate),
    });
    if (!parsed.success) {
      const fieldErrors: Partial<Record<keyof PRFFormData, string>> = {};
      parsed.error.errors.forEach((err) => {
        const path = err.path[0] as keyof PRFFormData;
        if (path) fieldErrors[path] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const url = prfId ? `/api/forms/prf/${prfId}` : "/api/forms/prf";
      const method = prfId ? "PUT" : "POST";
      const body = prfId
        ? parsed.data
        : { ...parsed.data, status: submitForApproval ? "pending" : "draft" };
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message ?? "Failed to save");
        return;
      }
      router.push(prfId ? `/dashboard/forms/prf/${prfId}` : "/dashboard/forms/prf");
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => handleSubmit(e, false);
  const handleSubmitForApproval = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    handleSubmit(e as unknown as React.FormEvent<HTMLFormElement>, true);
  };

  return (
    <form onSubmit={handleFormSubmit} className="flex flex-col gap-4">
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <Select
        label="Ministry"
        name="ministryId"
        options={ministries}
        value={formData.ministryId}
        onChange={handleChange}
        error={errors.ministryId}
      />
      <Input
        label="Request date"
        name="requestDate"
        type="date"
        value={formData.requestDate}
        onChange={handleChange}
        error={errors.requestDate}
      />
      <Input
        label="Amount requested"
        name="amountRequested"
        type="number"
        min={0}
        step={0.01}
        value={formData.amountRequested || ""}
        onChange={handleChange}
        error={errors.amountRequested}
      />
      <Input
        label="Purpose"
        name="purpose"
        value={formData.purpose}
        onChange={handleChange}
        error={errors.purpose}
      />
      <Textarea
        label="Justification"
        name="justification"
        value={formData.justification}
        onChange={handleChange}
        error={errors.justification}
      />
      {prfId && (
        <Select
          label="Status"
          name="status"
          options={canApprove ? STATUS_OPTIONS_APPROVER : STATUS_OPTIONS_CREATOR}
          value={formData.status}
          onChange={handleChange}
        />
      )}
      <div className="flex flex-wrap gap-2">
        {!prfId ? (
          <>
            <Button type="submit" variant="primary" loading={loading}>
              Create as draft
            </Button>
            {canApprove && (
              <Button
                type="button"
                variant="outline"
                loading={loading}
                onClick={handleSubmitForApproval}
              >
                Submit for approval
              </Button>
            )}
          </>
        ) : (
          <Button type="submit" variant="primary" loading={loading}>
            Update
          </Button>
        )}
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
