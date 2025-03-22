import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, Copy } from "lucide-react";
import useActorStore from "../State/Actors/ActorStore";
import useWalletStore from "../State/CryptoAssets/WalletStore";
import { toast } from "@/components/ui/use-toast";
import { Principal } from "@dfinity/principal";

const AdminRegistration = () => {
  const { identityManager } = useActorStore();
  const { approveSpender } = useWalletStore();
  const [adminPrincipal, setAdminPrincipal] = useState("");
  const [instituteName, setInstituteName] = useState("");
  const [institutePrincipal, setInstitutePrincipal] = useState("");
  const [loading, setLoading] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [whoAmILoading, setWhoAmILoading] = useState(false);

  const registerAdmin = async () => {
    if (!adminPrincipal.trim()) {
      toast({
        title: "Error",
        description: "Please enter an admin principal ID",
        variant: "destructive",
      });
      return;
    }

    setRegisterLoading(true);
    try {
      const result = await identityManager.registerAdmin(adminPrincipal);
      if (result.ok) {
        toast({
          title: "Admin Registered Successfully",
          description: result.ok,
        });
        setAdminPrincipal("");
      } else {
        toast({
          title: "Error Registering Admin",
          description: result.err,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error Registering Admin",
        description: String(error),
        variant: "destructive",
      });
    } finally {
      setRegisterLoading(false);
    }
  };

  const registerInstitute = async () => {
    if (!instituteName.trim()) {
      toast({
        title: "Error",
        description: "Please enter an institute name",
        variant: "destructive",
      });
      return;
    }

    if (!institutePrincipal.trim()) {
      toast({
        title: "Error",
        description: "Please enter an institute principal ID",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Get the identity manager principal
      const identityManagerPrincipal = Principal.fromText(
        process.env.CANISTER_ID_IDENTITY_MANAGER
      );

      // First approve the identity manager as a spender
      await approveSpender({
        spender: { owner: identityManagerPrincipal, subaccount: [] },
        amount: 100000, // COST_PER_PRINCIPAL_REGISTRATION_PERMIT
        memo: `Approve for ${instituteName}`,
      });

      // Register the institute name and permit the principal
      const result =
        await identityManager.registerInstituteName_PermitPrincipal(
          Principal.fromText(institutePrincipal),
          instituteName
        );

      if (result.ok) {
        toast({
          title: "Institute Registered Successfully",
          description: result.ok,
        });
        setInstituteName("");
        setInstitutePrincipal("");
      } else {
        console.log(result.err);
        toast({
          title: "Error Registering Institute",
          description: result.err,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.log(error);
      toast({
        title: "Error Registering Institute",
        description: String(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getMyPrincipal = async () => {
    setWhoAmILoading(true);
    try {
      const principal = await identityManager.whoami();
      const principalText = principal.toString();

      // Copy to clipboard
      await navigator.clipboard.writeText(principalText);

      toast({
        title: "Principal ID Copied",
        description: `Your principal ID: ${principalText.substring(0, 10)}...${principalText.substring(principalText.length - 5)}`,
      });
    } catch (error) {
      toast({
        title: "Error Getting Principal ID",
        description: String(error),
        variant: "destructive",
      });
    } finally {
      setWhoAmILoading(false);
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-8">
          {/* Who Am I Section */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Copy className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-medium">Get Your Principal ID</h3>
            </div>

            <Button
              onClick={getMyPrincipal}
              disabled={whoAmILoading}
              className="w-full"
              variant="outline"
            >
              {whoAmILoading
                ? "Getting Principal..."
                : "Who Am I? (Copy Principal ID)"}
            </Button>

            <div className="text-sm text-muted-foreground">
              <p>Click to get your principal ID and copy it to clipboard.</p>
              <p>You can use this ID for registration purposes.</p>
            </div>
          </div>

          {/* Admin Registration Section */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Shield className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-medium">Register New Admin</h3>
            </div>

            <div className="space-y-2">
              <Label htmlFor="adminPrincipal">Admin Principal ID</Label>
              <Input
                id="adminPrincipal"
                placeholder="Enter principal ID"
                value={adminPrincipal}
                onChange={(e) => setAdminPrincipal(e.target.value)}
              />
            </div>

            <Button
              onClick={registerAdmin}
              disabled={registerLoading}
              className="w-full"
            >
              {registerLoading ? "Registering..." : "Register Admin"}
            </Button>

            <div className="text-sm text-muted-foreground">
              <p>Only existing admins can register new admins.</p>
              <p>The principal ID must be in the correct format.</p>
            </div>
          </div>

          {/* Institute Registration Section */}
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center space-x-2">
              <Shield className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-medium">Register Institute</h3>
            </div>

            <div className="space-y-2">
              <Label htmlFor="instituteName">Institute Name</Label>
              <Input
                id="instituteName"
                placeholder="Enter institute name"
                value={instituteName}
                onChange={(e) => setInstituteName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="institutePrincipal">Institute Principal ID</Label>
              <Input
                id="institutePrincipal"
                placeholder="Enter institute principal ID"
                value={institutePrincipal}
                onChange={(e) => setInstitutePrincipal(e.target.value)}
              />
            </div>

            <Button
              onClick={registerInstitute}
              disabled={loading}
              className="w-full"
            >
              {loading ? "Registering..." : "Register Institute"}
            </Button>

            <div className="text-sm text-muted-foreground">
              <p>
                This will register the specified principal with the institute
                name.
              </p>
              <p>A fee of 100 tokens will be charged for registration.</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminRegistration;
