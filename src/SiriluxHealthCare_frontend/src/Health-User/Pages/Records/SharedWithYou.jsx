import React from "react";
import { DataReceivedTable } from "../../../Health-User/Tables/DataReceived";

export default function SharedWithYou() {
  return (
    <div>
      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="mt-4 w-full max-w-2xl">
          <DataReceivedTable />
        </div>
      </div>
    </div>
  );
}
