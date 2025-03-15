// Convert bytes to human-readable format
export function bytesToSize(bytes) {
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  if (bytes === 0) return "0 Bytes";
  const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)), 10);
  if (i === 0) return `${bytes} ${sizes[i]}`;
  return `${(bytes / 1024 ** i).toFixed(2)} ${sizes[i]}`;
}

// Convert seconds to human-readable time
export function secondsToHumanReadable(seconds) {
  if (seconds === 0) return "No time remaining";

  if (seconds > 86400) {
    // More than a day
    const days = Math.floor(seconds / 86400);
    return `${days} day${days !== 1 ? "s" : ""}`;
  } else if (seconds > 3600) {
    // More than an hour
    const hours = Math.floor(seconds / 3600);
    return `${hours} hour${hours !== 1 ? "s" : ""}`;
  } else if (seconds > 60) {
    // More than a minute
    const minutes = Math.floor(seconds / 60);
    return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
  } else {
    return `${Math.floor(seconds)} second${seconds !== 1 ? "s" : ""}`;
  }
}

export function formatTimeRemaining(timeObj) {
  if (!timeObj) return null;

  const { days, hours, minutes } = timeObj;

  if (days >= 30) {
    const months = Math.floor(days / 30);
    return `${months} month${months > 1 ? "s" : ""}`;
  } else if (days >= 1) {
    return `${Math.floor(days)} day${Math.floor(days) > 1 ? "s" : ""}`;
  } else if (hours >= 1) {
    return `${Math.floor(hours)} hour${Math.floor(hours) > 1 ? "s" : ""}`;
  } else {
    return `${Math.floor(minutes)} minute${Math.floor(minutes) > 1 ? "s" : ""}`;
  }
}
