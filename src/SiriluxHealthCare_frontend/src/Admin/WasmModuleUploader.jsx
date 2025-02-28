import React from "react";
import { useState, useContext, useEffect } from "react";
import {
  Upload,
  RefreshCw,
  AlertCircle,
  UserPlus,
  UserMinus,
} from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function WasmModuleUploader({ shardType }) {
  const {
    user,
    professional,
    facility,
    dataAsset,

    login,
    logout,
  } = useActorStore();
  const [wasmFile, setWasmFile] = useState(null);
  const [message, setMessage] = useState("");
  const [moduleType, setModuleType] = useState("Asset");
  const navigate = useNavigate();
  const [shardUpdateStatus, setShardUpdateStatus] = useState({});
  const [isUpdating, setIsUpdating] = useState(false);
  const [principalToAdd, setPrincipalToAdd] = useState("");
  const [principalToRemove, setPrincipalToRemove] = useState("");
  const [principalActionStatus, setPrincipalActionStatus] = useState({});
  const [isPrincipalActionInProgress, setIsPrincipalActionInProgress] =
    useState(false);

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
          result = await user.updateUserShardWasmModule(byteArray);
          break;
        case "professional":
          result =
            await professional.updateProfessionalShardWasmModule(byteArray);
          break;
        case "facility":
          result = await facility.updateFacilityShardWasmModule(byteArray);
          break;
        case "dataAsset":
          const shardTypeEnum = { [moduleType]: null };
          result = await dataAsset.updateDataAssetWasmModule(
            shardTypeEnum,
            byteArray
          );
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
          result = await facility.updateExistingShards();
          break;
        case "professional":
          result = await professional.updateExistingShards();
          break;
        case "user":
          result = await user.updateExistingShards();
          break;
        case "dataAsset":
          const shardTypeEnum = { [moduleType]: null };
          result = await dataAsset.updateExistingShards(shardTypeEnum);
          break;
        default:
      }
      console.log(result);

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

  const handleAddPermittedPrincipal = async () => {
    if (!principalToAdd) {
      setPrincipalActionStatus({
        status: "error",
        message: "Please enter a principal ID to add",
      });
      return;
    }

    setIsPrincipalActionInProgress(true);
    setPrincipalActionStatus({});

    try {
      let result;
      if (shardType === "user") {
        result = await user.addPermittedPrincipalToAllShards(principalToAdd);
      } else if (shardType === "dataAsset") {
        result =
          await dataAsset.addPermittedPrincipalToAllShards(principalToAdd);
      } else if (shardType === "professional") {
        result =
          await professional.addPermittedPrincipalToAllShards(principalToAdd);
      } else if (shardType === "facility") {
        result =
          await facility.addPermittedPrincipalToAllShards(principalToAdd);
      }
      console.log(result);
      if (result.ok) {
        setPrincipalActionStatus({
          status: "success",
          message: result.ok,
        });
        setPrincipalToAdd("");
      } else {
        setPrincipalActionStatus({
          status: "error",
          message: result.err,
        });
      }
    } catch (error) {
      setPrincipalActionStatus({
        status: "error",
        message: `Error adding principal: ${error.message}`,
      });
    } finally {
      setIsPrincipalActionInProgress(false);
    }
  };

  const handleRemovePermittedPrincipal = async () => {
    if (!principalToRemove) {
      setPrincipalActionStatus({
        status: "error",
        message: "Please enter a principal ID to remove",
      });
      return;
    }

    setIsPrincipalActionInProgress(true);
    setPrincipalActionStatus({});

    try {
      let result;
      if (shardType === "user") {
        result =
          await user.removePermittedPrincipalFromAllShards(principalToRemove);
      } else if (shardType === "dataAsset") {
        result =
          await dataAsset.removePermittedPrincipalFromAllShards(
            principalToRemove
          );
      } else if (shardType === "professional") {
        result =
          await professional.removePermittedPrincipalFromAllShards(
            principalToRemove
          );
      } else if (shardType === "facility") {
        result =
          await facility.removePermittedPrincipalFromAllShards(
            principalToRemove
          );
      }

      if (result.ok) {
        setPrincipalActionStatus({
          status: "success",
          message: result.ok,
        });
        setPrincipalToRemove("");
      } else {
        setPrincipalActionStatus({
          status: "error",
          message: result.err,
        });
      }
    } catch (error) {
      setPrincipalActionStatus({
        status: "error",
        message: `Error removing principal: ${error.message}`,
      });
    } finally {
      setIsPrincipalActionInProgress(false);
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

          <div className="grid grid-cols-1 gap-4">
            <button
              onClick={() => handleUpdateShards(shardType)}
              disabled={isUpdating}
              className={`p-3 rounded-md ${
                isUpdating ? "bg-gray-300" : "bg-blue-600 hover:bg-blue-700"
              } text-white transition-colors`}
            >
              {isUpdating
                ? "Updating..."
                : `Update ${shardType.charAt(0).toUpperCase() + shardType.slice(1)} Shards`}
            </button>
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

        {["user", "dataAsset", "professional", "facility"].includes(
          shardType
        ) && (
          <div className="mt-8 border-t pt-6">
            <h3 className="text-lg font-medium mb-2">
              Manage Permitted Principals
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Add or remove principals that are permitted to access all{" "}
              {shardType} shards.
            </p>

            <div className="mb-4">
              <Label
                htmlFor="add-principal"
                className="mb-2 block"
              >
                Add Principal
              </Label>
              <div className="flex gap-2">
                <Input
                  id="add-principal"
                  placeholder="Enter principal ID to add"
                  value={principalToAdd}
                  onChange={(e) => setPrincipalToAdd(e.target.value)}
                  className="flex-1"
                />
                <Button
                  onClick={handleAddPermittedPrincipal}
                  disabled={isPrincipalActionInProgress || !principalToAdd}
                  variant="outline"
                >
                  {isPrincipalActionInProgress ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <UserPlus className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="mb-4">
              <Label
                htmlFor="remove-principal"
                className="mb-2 block"
              >
                Remove Principal
              </Label>
              <div className="flex gap-2">
                <Input
                  id="remove-principal"
                  placeholder="Enter principal ID to remove"
                  value={principalToRemove}
                  onChange={(e) => setPrincipalToRemove(e.target.value)}
                  className="flex-1"
                />
                <Button
                  onClick={handleRemovePermittedPrincipal}
                  disabled={isPrincipalActionInProgress || !principalToRemove}
                  variant="outline"
                  className="text-red-500 border-red-200 hover:bg-red-50"
                >
                  {isPrincipalActionInProgress ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <UserMinus className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {principalActionStatus.message && (
              <Alert
                variant={
                  principalActionStatus.status === "error"
                    ? "destructive"
                    : "default"
                }
                className={
                  principalActionStatus.status === "success"
                    ? "bg-green-50 text-green-700 border-green-200"
                    : ""
                }
              >
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>
                  {principalActionStatus.status === "error"
                    ? "Error"
                    : "Success"}
                </AlertTitle>
                <AlertDescription>
                  {principalActionStatus.message}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default WasmModuleUploader;
