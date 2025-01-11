import React from "react";
import YourRecordsFiles from "../../sub/YourRecordsFiles";

export default function YourRecords() {
  return (
    <div>
      <div className="max-w-6xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-center p-8">
          <div className="mt-4 w-full">
            <YourRecordsFiles />
          </div>
        </div>
      </div>
    </div>
  );
}
