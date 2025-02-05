import React, { useState, useEffect, useContext } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ActorContext from "../ActorContext";

function FacilityApproval() {
  const { actors } = useContext(ActorContext);
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);

  const [sorting, setSorting] = useState([]);
  const [columnFilters, setColumnFilters] = useState([]);
  const [columnVisibility, setColumnVisibility] = useState({});
  const [rowSelection, setRowSelection] = useState({});

  useEffect(() => {
    fetchFacilities();
  }, []);

  const fetchFacilities = async () => {
    try {
      const result = await actors.facility.getPendingFacilityRequests();
      if (result.ok) {
        const formattedRequests = result.ok.map(([principal, data]) => {
          try {
            const demographicInfo = JSON.parse(
              new TextDecoder().decode(data.MetaData.DemographicInformation)
            );
            const licenseInfo = JSON.parse(
              new TextDecoder().decode(data.MetaData.LicenseInformation)
            );
            const servicesInfo = JSON.parse(
              new TextDecoder().decode(data.MetaData.ServicesOfferedInformation)
            );
            console.log(demographicInfo);
            console.log(licenseInfo);
            console.log(servicesInfo);
            return {
              id: principal,
              name: demographicInfo.facilityName || "N/A",
              registrationId: licenseInfo.registrationId || "N/A",
              serviceName: servicesInfo.serviceName || "N/A",
              serviceDesc: servicesInfo.serviceDesc || "N/A",
              location: `${demographicInfo.city || ""}, ${demographicInfo.state || ""}, ${demographicInfo.country || ""}`,
              status: "pending",
            };
          } catch (parseError) {
            console.error("Error parsing facility data:", parseError);
            return {
              id: principal,
              name: "Error parsing data",
              registrationId: "Error",
              serviceName: "Error",
              serviceDesc: "Error",
              location: "Error",
              status: "pending",
            };
          }
        });
        setFacilities(formattedRequests);
      } else {
        console.error("Error fetching pending requests:", result.err);
      }
    } catch (error) {
      console.error("Error fetching facilities:", error);
    }
    setLoading(false);
  };

  const handleStatusChange = async (id, action) => {
    try {
      let result;
      if (action === "approve") {
        result = await actors.facility.approveFacilityRequest(id);
      } else {
        result = await actors.facility.rejectFacilityRequest(id);
      }

      if (result.ok) {
        // Remove the facility from the list since it's been processed
        setFacilities(facilities.filter((f) => f.id !== id));
      } else {
        console.error(`Error ${action}ing facility:`, result.err);
      }
    } catch (error) {
      console.error(`Error ${action}ing facility:`, error);
    }
  };

  const StatusBadge = ({ status }) => {
    const colorMap = {
      pending: "bg-yellow-500",
      approved: "bg-green-500",
      denied: "bg-red-500",
    };
    return <Badge className={`${colorMap[status]} text-white`}>{status}</Badge>;
  };

  const columns = [
    {
      accessorKey: "name",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Facility Name
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
    },
    {
      accessorKey: "registrationId",
      header: "Registration ID",
    },
    {
      accessorKey: "serviceName",
      header: "Service Name",
    },
    {
      accessorKey: "serviceDesc",
      header: "Service Description",
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.getValue("status")} />,
      filterFn: (row, id, value) => {
        return value === "all" ? true : row.getValue(id) === value;
      },
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <>
          <Button
            variant="outline"
            size="sm"
            className="mr-2"
            onClick={() => handleStatusChange(row.original.id, "approve")}
            disabled={row.original.status !== "pending"}
          >
            Approve
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleStatusChange(row.original.id, "deny")}
            disabled={row.original.status !== "pending"}
          >
            Deny
          </Button>
        </>
      ),
    },
  ];

  const table = useReactTable({
    data: facilities,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  });

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between py-4">
        <div className="flex items-center space-x-2">
          <Input
            placeholder="Filter facility names..."
            value={table.getColumn("name")?.getFilterValue() ?? ""}
            onChange={(event) =>
              table.getColumn("name")?.setFilterValue(event.target.value)
            }
            className="max-w-sm"
          />
          <Select
            value={table.getColumn("status")?.getFilterValue() ?? "all"}
            onValueChange={(value) =>
              table
                .getColumn("status")
                ?.setFilterValue(value === "all" ? "" : value)
            }
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="denied">Denied</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

export default FacilityApproval;
