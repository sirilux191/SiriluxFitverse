import React from "react";
import { useState, useContext } from "react";
import { Upload, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useNavigate } from "react-router-dom";
import useActorStore from "../State/Actors/ActorStore";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function WasmModuleUploader({ shardType }) {
  const { actors, login, logout } = useActorStore();
  const [wasmFile, setWasmFile] = useState(null);
  const [message, setMessage] = useState("");
  const [moduleType, setModuleType] = useState("Asset");
  const navigate = useNavigate();
  const [shardUpdateStatus, setShardUpdateStatus] = useState({});
  const [isUpdating, setIsUpdating] = useState(false);

  const readFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => resolve(event.target.result);
      reader.onerror = (error) => reject(error);
      reader.readAsArrayBuffer(file);
    });
  };

  const handleWasmFileChange = (event) => {
    if (event.target.files && event.target.files.length > 0) {
      setWasmFile(event.target.files[0]);
    }
  };

  const handleUpdateWasmModule = async (event) => {
    event.preventDefault();
    if (!wasmFile) {
      setMessage("Please select a WASM file first.");
      return;
    }

    try {
      const arrayBuffer = await readFile(wasmFile);
      const byteArray = [...new Uint8Array(arrayBuffer)];

      let result;
      switch (shardType) {
        case "user":
          result = await actors.user.updateWasmModule(byteArray);
          break;
        case "professional":
          result = await actors.professional.updateWasmModule(byteArray);
          break;
        case "facility":
          result = await actors.facility.updateWasmModule(byteArray);
          break;
        case "dataAsset":
          const shardTypeEnum = { [moduleType]: null };
          result = await actors.dataAsset.updateWasmModule(
            shardTypeEnum,
            byteArray
          );
          break;
        case "marketplace":
          result = await actors.marketplace.updateWasmModule(byteArray);
          break;
        case "sharedActivity":
          console.log(actors.sharedActivity);
          result = await actors.sharedActivity.updateWasmModule(byteArray);
          break;
        default:
          setMessage("Unknown shard type");
          return;
      }

      if ("ok" in result) {
        setMessage(
          `WASM module for ${shardType} ${moduleType} updated successfully.`
        );
      } else {
        setMessage(`Error updating ${shardType} WASM module: ${result.err}`);
      }
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    }
  };

  const handleUpdateShards = async (service) => {
    setIsUpdating(true);
    try {
      let result;
      switch (service) {
        case "facility":
          result = await actors.facility.updateExistingShards();
          break;
        case "professional":
          result = await actors.professional.updateExistingShards();
          break;
        case "user":
          result = await actors.user.updateExistingShards();
          break;
        case "dataAsset":
          const shardTypeEnum = { [moduleType]: null };
          result = await actors.dataAsset.updateExistingShards(shardTypeEnum);
          break;
        case "sharedActivity":
          result = await actors.sharedActivity.updateExistingShards();
          break;
        default:
      }

      if (result.err) {
        setShardUpdateStatus({ status: "error", message: result.err });
      } else {
        setShardUpdateStatus({
          status: "success",
          message: "Shards updated successfully",
        });
      }
    } catch (error) {
      setShardUpdateStatus({ status: "error", message: error.message });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Card className="mt-8">
      <CardHeader>
        <div className="flex space-x-4 mb-4">
          <Button onClick={login}>Login</Button>
          <Button
            onClick={() => {
              logout();
              navigate("/");
            }}
          >
            Logout
          </Button>
        </div>
        <CardTitle className="flex items-center text-lg font-semibold">
          <RefreshCw className="mr-2 h-6 w-6" />
          Update {shardType.charAt(0).toUpperCase() + shardType.slice(1)} WASM
          Module
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <form
          onSubmit={handleUpdateWasmModule}
          className="space-y-6"
        >
          <div className="flex flex-col space-y-4">
            {shardType === "dataAsset" && (
              <Select
                value={moduleType}
                onValueChange={setModuleType}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select module type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Asset">Asset Module</SelectItem>
                  <SelectItem value="Storage">Storage Module</SelectItem>
                  <SelectItem value="SharedActivity">
                    Shared Activity Module
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
            <div
              className="flex items-center justify-center w-full h-32 p-4 border-2 border-gray-300 border-dashed rounded-md cursor-pointer hover:border-gray-400 focus:outline-none"
              onClick={() =>
                document.getElementById(`file-upload-${shardType}`).click()
              }
            >
              <span className="flex items-center space-x-2 text-gray-600">
                <Upload className="w-6 h-6" />
                <span className="font-medium">
                  {wasmFile
                    ? wasmFile.name
                    : shardType === "dataAsset"
                      ? "Click to upload WASM file (regular or storage)"
                      : "Click to upload WASM file"}
                </span>
              </span>
              <input
                id={`file-upload-${shardType}`}
                name="file-upload"
                type="file"
                accept=".wasm"
                className="hidden"
                onChange={handleWasmFileChange}
              />
            </div>
            <Button
              type="submit"
              className="w-full"
            >
              Upload
            </Button>
          </div>
        </form>
        {message && (
          <Alert className="mt-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Update Status</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}

        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-4">Update Existing Shards</h3>

          <div className="grid grid-cols-2 gap-4">
            {[
              "facility",
              "professional",
              "user",
              "dataAsset",
              "sharedActivity",
            ].map((service) => (
              <button
                key={service}
                onClick={() => handleUpdateShards(service)}
                disabled={isUpdating}
                className={`p-3 rounded-md ${
                  isUpdating ? "bg-gray-300" : "bg-blue-600 hover:bg-blue-700"
                } text-white transition-colors`}
              >
                {isUpdating
                  ? "Updating..."
                  : `Update ${service.replace(/([A-Z])/g, " $1")} Shards`}
              </button>
            ))}
          </div>

          {shardUpdateStatus.message && (
            <div
              className={`mt-4 p-3 rounded-md ${
                shardUpdateStatus.status === "error"
                  ? "bg-red-100 text-red-700"
                  : "bg-green-100 text-green-700"
              }`}
            >
              {shardUpdateStatus.message}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default WasmModuleUploader;
