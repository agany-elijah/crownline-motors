import type { Metadata } from "next"
import Link from "next/link"
import { Search, Users } from "lucide-react"

import { AdminEmptyState } from "@/components/admin/admin-empty-state"
import { AdminListCount } from "@/components/admin/admin-list-toolbar"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { DataTable, DataTableRecordLink, type DataTableColumn } from "@/components/admin/data-table"
import { Pagination } from "@/components/shared/pagination"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { requirePermission } from "@/lib/auth/admin-guard"
import { ADMIN_BASE_PATH } from "@/lib/constants/admin-routes"
import { listCustomers, type CustomerListItem } from "@/lib/queries/customer.queries"
import { customerListFiltersSchema } from "@/lib/validations/customer.schema"

export const metadata: Metadata = {
  title: "Customers",
}

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" })

/** Everyone who has sent a quote request, newest first. */
export default async function AdminCustomersPage(props: PageProps<"/Ricky@2000/customers">) {
  await requirePermission("customer:read")

  const searchParams = await props.searchParams
  const filters = customerListFiltersSchema.parse({ search: searchParams.search, page: searchParams.page })
  const result = await listCustomers(filters)

  const columns: DataTableColumn<CustomerListItem>[] = [
    {
      id: "customer",
      header: "Customer",
      render: (customer) => (
        <DataTableRecordLink
          href={`${ADMIN_BASE_PATH}/customers/${customer.id}`}
          title={customer.fullName}
          reference={customer.email ?? undefined}
          leading={<CustomerInitials name={customer.fullName} />}
        />
      ),
    },
    {
      id: "phone",
      header: "Phone",
      hideBelow: "sm",
      render: (customer) => <span className="font-mono text-xs text-foreground tabular-nums">{customer.phone}</span>,
    },
    {
      id: "city",
      header: "City",
      hideBelow: "lg",
      render: (customer) => <span className="text-small text-muted-foreground">{customer.city ?? "—"}</span>,
    },
    {
      id: "quotes",
      header: "Quotes",
      align: "right",
      hideBelow: "md",
      render: (customer) => <span className="text-muted-foreground tabular-nums">{customer.quoteCount}</span>,
    },
    {
      id: "orders",
      header: "Orders",
      align: "right",
      render: (customer) => (
        <span
          className={
            customer.orderCount > 0 ? "text-foreground tabular-nums" : "text-muted-foreground tabular-nums"
          }
        >
          {customer.orderCount}
        </span>
      ),
    },
    {
      id: "last",
      header: "Last enquiry",
      align: "right",
      hideBelow: "md",
      render: (customer) => (
        <span className="text-small text-muted-foreground">
          {DATE_FORMAT.format(customer.lastEnquiryAt ?? customer.createdAt)}
        </span>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Customers"
        description="Everyone who has sent a quote request, with their enquiries and orders."
      />

      {/*
        A plain GET form rather than the debounced search the other lists use:
        it works before hydration, and a customer is usually looked up by a
        number read off a call, typed in full and submitted.
      */}
      <form method="get" action={`${ADMIN_BASE_PATH}/customers`} role="search" className="relative w-full sm:max-w-sm">
        <Label htmlFor="customer-search" className="sr-only">
          Search customers
        </Label>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          id="customer-search"
          name="search"
          type="search"
          defaultValue={filters.search ?? ""}
          placeholder="Name, phone, email, quote or order number…"
          className="pl-9"
        />
      </form>

      <DataTable
        columns={columns}
        rows={result.customers}
        getRowKey={(customer) => customer.id}
        caption="Customers"
        emptyState={
          filters.search ? (
            <AdminEmptyState
              icon={Users}
              title="No customers match"
              description="Nobody on file matches that name, number or email."
              action={
                <Button render={<Link href={`${ADMIN_BASE_PATH}/customers`} />} variant="outline">
                  Show all customers
                </Button>
              }
            />
          ) : (
            <AdminEmptyState
              icon={Users}
              title="No customers yet"
              description="A customer record is created the first time someone sends a quote request."
            />
          )
        }
      />

      {result.pageCount > 1 ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <AdminListCount total={result.total} noun="customers" />
          <Pagination
            page={result.page}
            pageCount={result.pageCount}
            hrefFor={(target) => {
              const params = new URLSearchParams()
              if (filters.search) params.set("search", filters.search)
              if (target > 1) params.set("page", String(target))
              const query = params.toString()
              return query ? `${ADMIN_BASE_PATH}/customers?${query}` : `${ADMIN_BASE_PATH}/customers`
            }}
            label="Customer list pages"
            className="border-t-0 pt-0"
          />
        </div>
      ) : null}
    </div>
  )
}

/** Two letters in a quiet disc — enough to scan a column of names by shape. */
function CustomerInitials({ name }: { name: string }) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const initials =
    words.length === 0
      ? "?"
      : words.length === 1
        ? words[0].slice(0, 2).toUpperCase()
        : `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase()

  return (
    <span
      aria-hidden="true"
      className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-secondary text-[0.6875rem] font-semibold text-muted-foreground"
    >
      {initials}
    </span>
  )
}
