import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Clipboard, RefreshCw } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import useActorStore from "../State/Actors/ActorStore";

const RegistrationCodeManagement = () => {
  const { user } = useActorStore();
  const [codes, setCodes] = useState([]);
  const [codeCount, setCodeCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Fetch available registration codes and count
  const fetchCodes = async () => {
    try {
      setLoading(true);
      const countResult = await user.getRegistrationCodeCount();
      const codesResult = await user.getAvailableRegistrationCodes();

      if ("ok" in countResult) {
        setCodeCount(countResult.ok);
      }

      if ("ok" in codesResult) {
        setCodes(codesResult.ok);
      }
    } catch (error) {
      console.error("Error fetching registration codes:", error);
      toast({
        title: "Error",
        description: "Failed to fetch registration codes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Generate new registration codes
  const generateCodes = async () => {
    try {
      setGenerating(true);
      const result = await user.generateRegistrationCodes();

      if ("ok" in result) {
        toast({
          title: "Success",
          description: "Generated 100 new registration codes",
          variant: "success",
        });
        // Refresh the codes list and count
        fetchCodes();
      } else if ("err" in result) {
        toast({
          title: "Error",
          description: result.err,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error generating registration codes:", error);
      toast({
        title: "Error",
        description: "Failed to generate registration codes",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  // Copy code to clipboard
  const copyToClipboard = (code) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Copied",
      description: `Code ${code} copied to clipboard`,
    });
  };

  // Load codes on component mount
  useEffect(() => {
    fetchCodes();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Registration Codes</h3>
          <p className="text-sm text-muted-foreground">
            Available codes: {codeCount}
          </p>
        </div>
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchCodes}
            disabled={loading}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Button
            onClick={generateCodes}
            disabled={generating}
          >
            {generating ? "Generating..." : "Generate 100 New Codes"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {codes.map((code) => (
          <Card
            key={code}
            className="overflow-hidden"
          >
            <CardContent className="p-3 flex justify-between items-center">
              <code className="text-sm font-mono">{code}</code>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => copyToClipboard(code)}
              >
                <Clipboard className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {codes.length === 0 && !loading && (
        <div className="text-center py-10 text-muted-foreground">
          No registration codes available. Generate some using the button above.
        </div>
      )}

      {loading && (
        <div className="text-center py-10 text-muted-foreground">
          Loading registration codes...
        </div>
      )}
    </div>
  );
};

export default RegistrationCodeManagement;
