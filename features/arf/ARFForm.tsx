"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Textarea, Select } from "@/components/ui";
import { arfSchema, type ARFFormData } from "@/schemas/arf";

/** Form state uses string for date (HTML input type="date" format) */
type ARFFormState = Omit<ARFFormData, "requestedDate"> & { requestedDate: string };
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

export function ARFForm({ arfId, canApprove = false }: { arfId?: string; canApprove?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ministries, setMinistries] = useState<SelectOption[]>([]);
  const [formData, setFormData] = useState<ARFFormState>({
    ministryId: "",
    eventName: "",
    requestedDate: new Date().toISOString().slice(0, 10),
    what: "",
    when: "",
    where: "",
    why: "",
    justification: "",
    status: "draft",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof ARFFormData, string>>>({});

  useEffect(() => {
    const url = arfId ? "/api/options/ministries" : "/api/options/ministries?context=user-create";
    fetch(url)
      .then((r) => r.json())
      .then((data: { id: string; name: string }[]) =>
        setMinistries(data.map((m) => ({ value: m.id, label: m.name })))
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!arfId) return;
    fetch(`/api/forms/arf/${arfId}`)
      .then((r) => r.json())
      .then((data: ARFFormState) => {
        setFormData({
          ministryId: data.ministryId,
          eventName: data.eventName,
          requestedDate: data.requestedDate?.slice(0, 10) ?? "",
          what: data.what,
          when: data.when,
          where: data.where,
          why: data.why,
          justification: data.justification,
          status: data.status ?? "draft",
        });
      })
      .catch(() => setError("Failed to load ARF"));
  }, [arfId, setFormData, setError]);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof ARFFormData]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>, submitForApproval = false) {
    e.preventDefault();
    setError(null);
    const parsed = arfSchema.safeParse({
      ...formData,
      requestedDate: new Date(formData.requestedDate),
    });
    if (!parsed.success) {
      const fieldErrors: Partial<Record<keyof ARFFormData, string>> = {};
      parsed.error.errors.forEach((err) => {
        const path = err.path[0] as keyof ARFFormData;
        if (path) fieldErrors[path] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const url = arfId ? `/api/forms/arf/${arfId}` : "/api/forms/arf";
      const method = arfId ? "PUT" : "POST";
      const body = arfId
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
      router.push(arfId ? `/dashboard/forms/arf/${arfId}` : "/dashboard/forms/arf");
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
        label="Event Name"
        name="eventName"
        value={formData.eventName}
        onChange={handleChange}
        error={errors.eventName}
      />
      <Input
        label="Date"
        name="requestedDate"
        type="date"
        value={formData.requestedDate}
        onChange={handleChange}
        error={errors.requestedDate}
      />
      <Input
        label="What"
        name="what"
        value={formData.what}
        onChange={handleChange}
        error={errors.what}
      />
      <Input
        label="When"
        name="when"
        value={formData.when}
        onChange={handleChange}
        error={errors.when}
      />
      <Input
        label="Where"
        name="where"
        value={formData.where}
        onChange={handleChange}
        error={errors.where}
      />
      <Textarea
        label="Why"
        name="why"
        value={formData.why}
        onChange={handleChange}
        error={errors.why}
      />
      <Textarea
        label="Justification"
        name="justification"
        value={formData.justification}
        onChange={handleChange}
        error={errors.justification}
      />
      {arfId && (
        <Select
          label="Status"
          name="status"
          options={canApprove ? STATUS_OPTIONS_APPROVER : STATUS_OPTIONS_CREATOR}
          value={formData.status}
          onChange={handleChange}
        />
      )}
      <div className="flex flex-wrap gap-2">
        {!arfId ? (
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
