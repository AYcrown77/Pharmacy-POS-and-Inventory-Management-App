"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { UserPlus, Users } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Input, SearchInput } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/States";
import { useDebounce } from "@/hooks/useDebounce";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import { toErrorMessage } from "@/lib/api/http";
import { customersService } from "@/services/customers.service";
import type { Customer } from "@/types/domain";

/**
 * Attaches an account to the sale in front of the cashier.
 *
 * The balance is shown against every result, not just the chosen one, because
 * the decision the cashier is making — can this person take goods without
 * paying? — depends on what they already owe. Finding that out after picking
 * them would be one step too late.
 */
export function CustomerPicker({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (customer: Customer | null) => void;
}) {
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);

  const debounced = useDebounce(search);

  const list = useQuery({
    queryKey: ["customers", "picker", debounced],
    queryFn: () =>
      customersService.list({
        search: debounced.trim() || undefined,
        isActive: true,
        pageSize: 20,
      }),
    enabled: open,
  });

  const create = useMutation({
    mutationFn: () =>
      customersService.create({
        name: name.trim(),
        phone: phone.trim() || null,
        note: null,
      }),
    onSuccess: (customer) => {
      onSelect(customer);
      close();
    },
    onError: (err) => setError(toErrorMessage(err)),
  });

  function close() {
    setSearch("");
    setCreating(false);
    setName("");
    setPhone("");
    setError(null);
    onOpenChange(false);
  }

  return (
    <Modal
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
      title={creating ? "New customer" : "Choose a customer"}
      description={
        creating
          ? "Only a named account can carry a balance."
          : "Search by name or phone number."
      }
      size="sm"
      footer={
        creating ? (
          <>
            <Button variant="secondary" onClick={() => setCreating(false)}>
              Back
            </Button>
            <Button
              variant="primary"
              loading={create.isPending}
              disabled={!name.trim()}
              onClick={() => create.mutate()}
            >
              Create and select
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              leadingIcon={<UserPlus className="size-4" />}
              onClick={() => setCreating(true)}
            >
              New customer
            </Button>
          </>
        )
      }
    >
      {creating ? (
        <div className="flex flex-col gap-3">
          <Input
            value={name}
            autoFocus
            placeholder="Full name"
            aria-label="Customer name"
            onChange={(event) => setName(event.target.value)}
          />
          <Input
            value={phone}
            inputMode="tel"
            placeholder="Phone number (optional)"
            aria-label="Phone number"
            onChange={(event) => setPhone(event.target.value)}
          />
          {error && <p className="text-meta text-danger-600">{error}</p>}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <SearchInput
            value={search}
            autoFocus
            placeholder="Search name or phone"
            aria-label="Search customers"
            onChange={(event) => setSearch(event.target.value)}
            onClear={() => setSearch("")}
          />

          <button
            type="button"
            onClick={() => {
              onSelect(null);
              close();
            }}
            className="flex h-control items-center rounded-md px-3 text-left text-base text-neutral-700 ring-1 ring-inset ring-neutral-200 hover:bg-neutral-50"
          >
            Walk-in customer (no account)
          </button>

          <ul className="max-h-72 overflow-y-auto rounded-md ring-1 ring-neutral-200">
            {(list.data?.data ?? []).map((customer) => (
              <li key={customer.id}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(customer);
                    close();
                  }}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-primary-50"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-base font-medium text-neutral-900">
                      {customer.name}
                    </span>
                    {customer.phone && (
                      <span className="block truncate text-meta text-neutral-500">
                        {customer.phone}
                      </span>
                    )}
                  </span>
                  <span
                    className={cn(
                      "num shrink-0 text-meta font-semibold",
                      customer.balance > 0
                        ? "text-danger-700"
                        : customer.balance < 0
                          ? "text-success-700"
                          : "text-neutral-400",
                    )}
                  >
                    {customer.balance > 0
                      ? `Owes ${formatMoney(customer.balance)}`
                      : customer.balance < 0
                        ? `In credit ${formatMoney(-customer.balance)}`
                        : "Settled"}
                  </span>
                </button>
              </li>
            ))}

            {!list.isPending && (list.data?.data ?? []).length === 0 && (
              <li className="p-4">
                <EmptyState
                  icon={<Users className="size-5" />}
                  title="No customers match"
                />
              </li>
            )}
          </ul>
        </div>
      )}
    </Modal>
  );
}
