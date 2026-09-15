import type { Metadata } from "next"
import Link from "next/link"
import { Search, Users } from "lucide-react"

import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { DataTable, type DataTableColumn } from "@/components/admin/data-table"
import { Pagination } from "@/components/shared/pagination"
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
        <Link
          href={`${ADMIN_BASE_PATH}/customers/${customer.id}`}
          className="group/link flex flex-col gap-0.5 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <span className="font-semibold transition-colors duration-fast group-hover/link:text-gold-ink">
            {customer.fullName}
          </span>
          {customer.email ? <span className="text-xs text-muted-foreground">{customer.email}</span> : null}
        </Link>
      ),
    },
    {
      id: "phone",
      header: "Phone",
      hideBelow: "sm",
      render: (customer) => <span className="text-small tabular-nums">{customer.phone}</span>,
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
      render: (customer) => <span className="tabular-nums">{customer.quoteCount}</span>,
    },
    {
      id: "orders",
      header: "Orders",
      align: "right",
      render: (customer) => <span className="tabular-nums">{customer.orderCount}</span>,
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
    <div className="flex flex-col gap-8">
      <AdminPageHeader title="Customers" />

      <form method="get" action={`${ADMIN_BASE_PATH}/customers`} role="search" className="relative max-w-md">
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
          <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
            <span
              aria-hidden="true"
              className="flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground"
            >
              <Users className="size-6" />
            </span>
            <h2 className="font-heading text-h3 font-semibold">
              {filters.search ? "No matches" : "No customers yet"}
            </h2>
            {filters.search ? (
              <Link href={`${ADMIN_BASE_PATH}/customers`} className="text-small font-medium text-gold-ink hover:underline">
                Show all customers
              </Link>
            ) : null}
          </div>
        }
      />

      {result.pageCount > 1 ? (
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
        />
      ) : null}
    </div>
  )
}
