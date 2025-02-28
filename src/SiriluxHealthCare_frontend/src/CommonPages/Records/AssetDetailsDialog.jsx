import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { ShareDataFunc } from "@/Functions/ShareData";
import DownloadFile from "@/Functions/DownloadFile";
import EditFile from "@/Functions/EditFile";

export default function AssetDetailsDialog({
  isOpen,
  onClose,
  record,
  getIconByCategory,
  handleDelete,
  generateAISummary,
  isGeneratingSummary,
  aiSummary,
  errorMessage,
  downloadAISummary,
}) {
  if (!record) return null;

  // Add debugging log
  console.log("Record metadata:", record.metadata);
  console.log("File format:", record.metadata.format);

  // Handle MIME types
  const format = (record.metadata?.format || record.format || "")
    .toString()
    .toLowerCase();
  const isSupportedForAI = [
    "application/pdf",
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
  ].includes(format);

  // Add debugging log
  console.log("Format:", format);
  console.log("Is supported for AI:", isSupportedForAI);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={onClose}
    >
      <DialogContent className="bg-gray-900 text-white border border-gray-700 w-[95vw] sm:w-[90vw] max-w-[700px] max-h-[90vh] p-0 rounded-xl flex flex-col">
        <div className="flex flex-col h-full">
          <DialogHeader className="border-b border-gray-700 p-4">
            <DialogTitle className="flex flex-col sm:flex-row gap-3 sm:items-center">
              <div className="p-2 bg-gray-800 rounded-lg w-fit">
                {getIconByCategory(record.metadata.category)}
              </div>
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold text-white break-words">
                  {record.title}
                </h2>
                <p className="text-sm text-gray-400">
                  {record.metadata.category}
                </p>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="p-4 space-y-4 overflow-y-auto flex-1">
            <div className="space-y-2">
              <h4 className="text-gray-300 text-sm font-medium">Description</h4>
              <p className="text-gray-200 text-sm leading-relaxed bg-gray-800/50 rounded-lg p-3 border border-gray-700">
                {record.metadata.description}
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="text-gray-300 text-sm font-medium">Keywords</h4>
              <div className="flex flex-wrap gap-2">
                {record.metadata.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="bg-gray-800/50 text-blue-400 px-3 py-1 rounded-full text-xs border border-gray-700"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {aiSummary && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="text-gray-300 text-sm font-medium flex items-center gap-2">
                    AI Summary
                    <span className="bg-indigo-600/30 text-indigo-400 text-xs px-2 py-0.5 rounded-full border border-indigo-500/30">
                      AI
                    </span>
                  </h4>

                  <Button
                    onClick={downloadAISummary}
                    className="h-8 bg-indigo-600/70 hover:bg-indigo-700 text-white rounded-lg transition-colors flex items-center justify-center gap-1 text-xs font-medium px-2"
                  >
                    Download Summary
                  </Button>
                </div>
                <div className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden hover:border-indigo-600/50 transition-colors">
                  <div className="text-sm text-gray-200 font-sans leading-relaxed p-3 overflow-y-auto max-h-[150px]">
                    {aiSummary}
                  </div>
                </div>
              </div>
            )}

            {errorMessage && (
              <div className="bg-red-900/30 border border-red-700/50 text-red-300 p-3 rounded-lg text-sm">
                {errorMessage}
              </div>
            )}
          </div>

          <div className="p-4 border-t border-gray-700 bg-gray-900">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <DownloadFile
                dataAssetShardPrincipal={record.dataAssetShardPrincipal}
                dataStorageShardPrincipal={record.dataStorageShardPrincipal}
                uniqueID={record.assetID}
                title={record.title}
                format={record.metadata.format}
                accessLevel="owned"
                className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium"
              />

              <EditFile
                dataAssetShardPrincipal={record.dataAssetShardPrincipal}
                uniqueID={record.assetID}
                format={record.metadata.format}
                title={record.title}
                category={record.metadata.category}
                className="w-full h-10 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium"
              />

              <ShareDataFunc
                assetID={record.assetID}
                className="w-full h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium"
              />

              <Button
                onClick={() => handleDelete(record.assetID)}
                className="w-full h-10 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium"
              >
                <Trash2 size={18} />
                Delete
              </Button>
            </div>

            <div className="mt-3">
              {isSupportedForAI ? (
                <Button
                  onClick={() => generateAISummary(record.assetID)}
                  disabled={isGeneratingSummary}
                  className="w-full h-10 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGeneratingSummary ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                      Analyzing...
                    </>
                  ) : (
                    "Generate AI Summary"
                  )}
                </Button>
              ) : (
                <div className="w-full h-10 bg-gray-700 text-gray-300 rounded-lg flex items-center justify-center gap-2 text-sm font-medium cursor-not-allowed">
                  AI Summary not available for this file type
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
