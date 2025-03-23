import React, { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalendarIcon } from "@heroicons/react/24/outline";
import { format } from "date-fns";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TimeSlotPicker = ({
  // Props for range mode
  startDate,
  endDate,
  onDateRangeChange,
  startTime,
  endTime,
  onTimeRangeChange,
  // Props for single mode
  selectedDate,
  onDateChange,
  selectedTime,
  onTimeChange,
  // Mode prop to determine behavior
  mode = "single", // or "range"
}) => {
  const [open, setOpen] = useState(false);

  // Generate time slots for every 30 minutes
  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute of [0, 30]) {
        const time = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
        slots.push(time);
      }
    }
    return slots;
  };

  const handleTimeChange = (type, time) => {
    if (mode === "range") {
      onTimeRangeChange?.(
        type === "start"
          ? { start: time, end: endTime }
          : { start: startTime, end: time }
      );
    } else {
      onTimeChange?.(time);
      setOpen(false);
    }
  };

  let displayText = "";
  if (mode === "range") {
    displayText =
      startDate && endDate
        ? `${format(startDate, "MMM dd")} - ${format(endDate, "MMM dd")}`
        : "Select date range";
  } else {
    displayText =
      selectedDate && selectedTime
        ? `${format(selectedDate, "MMM dd, yyyy")} ${selectedTime}`
        : "Select date and time";
  }

  return (
    <div className="relative">
      <Input
        value={displayText}
        readOnly
        className="pl-10"
      />
      <Popover
        open={open}
        onOpenChange={setOpen}
      >
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            className="absolute left-0 top-0 h-full px-3 py-2 hover:bg-transparent"
          >
            <CalendarIcon className="h-4 w-4 text-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-0"
          align="start"
        >
          <div className="p-4 space-y-4">
            {mode === "range" ? (
              <>
                <Calendar
                  mode="range"
                  selected={{ from: startDate, to: endDate }}
                  onSelect={onDateRangeChange}
                  disabled={(date) => date < new Date()}
                  initialFocus
                  numberOfMonths={2}
                />
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-sm font-medium mb-1 block">
                      Start Time
                    </label>
                    <Select
                      value={startTime}
                      onValueChange={(time) => handleTimeChange("start", time)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Start time" />
                      </SelectTrigger>
                      <SelectContent>
                        {generateTimeSlots().map((time) => (
                          <SelectItem
                            key={time}
                            value={time}
                            disabled={endTime && time >= endTime}
                          >
                            {time}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1">
                    <label className="text-sm font-medium mb-1 block">
                      End Time
                    </label>
                    <Select
                      value={endTime}
                      onValueChange={(time) => handleTimeChange("end", time)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="End time" />
                      </SelectTrigger>
                      <SelectContent>
                        {generateTimeSlots().map((time) => (
                          <SelectItem
                            key={time}
                            value={time}
                            disabled={startTime && time <= startTime}
                          >
                            {time}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            ) : (
              <>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    onDateChange?.(date);
                  }}
                  disabled={(date) => date < new Date()}
                  initialFocus
                />
                <Select
                  value={selectedTime}
                  onValueChange={(time) => handleTimeChange(null, time)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select time" />
                  </SelectTrigger>
                  <SelectContent>
                    {generateTimeSlots().map((time) => (
                      <SelectItem
                        key={time}
                        value={time}
                      >
                        {time}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default TimeSlotPicker;
