import React, { useState, useEffect } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pencil, Plus } from "lucide-react";
import useActorStore from "@/State/Actors/ActorStore";
import { toast } from "@/components/ui/use-toast";

const AIAgentManagement = () => {
  const { aiAgentSystem } = useActorStore();
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    id: "",
    name: "",
    assistantId: "",
    specialization: "",
    description: "",
    visitCost: 0,
  });

  // Fetch all AI agents
  const fetchAgents = async () => {
    try {
      setLoading(true);
      if (!aiAgentSystem) {
        toast({
          title: "AI Agent System actor not initialized",
          description: "AI Agent System actor not initialized",
        });
        return;
      }

      const result = await aiAgentSystem.getAllAIAgents();
      setAgents(result);
    } catch (error) {
      console.error("Error fetching AI agents:", error);
      toast({
        title: "Failed to fetch AI agents",
        description: "Failed to fetch AI agents",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (aiAgentSystem) {
      fetchAgents();
    }
  }, [aiAgentSystem]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === "visitCost") {
      setFormData({
        ...formData,
        [name]: Number(value),
      });
    } else if (name === "specialization") {
      setFormData({
        ...formData,
        [name]: value,
      });
    } else {
      setFormData({
        ...formData,
        [name]: value,
      });
    }
  };

  const handleAddAgent = () => {
    setSelectedAgent(null);
    setFormData({
      id: "",
      name: "",
      assistantId: "",
      specialization: "",
      description: "",
      visitCost: 0,
    });
    setDialogOpen(true);
  };

  const handleEditAgent = (agent) => {
    setSelectedAgent(agent);
    setFormData({
      id: agent.id,
      name: agent.name,
      assistantId: agent.assistantId,
      specialization: agent.specialization.join(", "),
      description: agent.description,
      visitCost: agent.visitCost,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const specializations = formData.specialization
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s !== "");

      if (selectedAgent) {
        // Update existing agent
        const result = await aiAgentSystem.updateAIAgent(
          formData.id,
          formData.name,
          formData.assistantId,
          specializations,
          formData.description,
          formData.visitCost
        );

        if (result.ok) {
          toast({
            title: "AI Agent updated successfully",
            description: "AI Agent updated successfully",
          });
          fetchAgents();
        } else {
          toast({
            title: "Failed to update AI Agent",
            description: `Failed to update AI Agent: ${result.err}`,
          });
        }
      } else {
        // Create new agent
        const result = await aiAgentSystem.registerAIAgent(
          formData.name,
          formData.assistantId,
          specializations,
          formData.description,
          formData.visitCost
        );

        if (result.ok) {
          toast({
            title: "AI Agent created successfully",
            description: "AI Agent created successfully",
          });
          fetchAgents();
        } else {
          toast({
            title: "Failed to create AI Agent",
            description: `Failed to create AI Agent: ${result.err}`,
          });
        }
      }
      setDialogOpen(false);
    } catch (error) {
      console.error("Error submitting form:", error);
      toast.error("An error occurred while saving the AI Agent");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">AI Agent Management</h2>
        <Button onClick={handleAddAgent}>
          <Plus className="mr-2 h-4 w-4" /> Add AI Agent
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-40">
          <p>Loading AI Agents...</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <Card
              key={agent.id}
              className="overflow-hidden"
            >
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle>{agent.name}</CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEditAgent(agent)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
                <CardDescription>
                  Assistant ID: {agent.assistantId}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1 mb-3">
                    {agent.specialization.map((spec) => (
                      <Badge
                        key={spec}
                        variant="secondary"
                      >
                        {spec}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {agent.description}
                  </p>
                  <p className="text-sm font-medium">
                    Visit Cost: {agent.visitCost} tokens
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}

          {agents.length === 0 && (
            <div className="col-span-full text-center py-10">
              <p className="text-muted-foreground">
                No AI Agents found. Create one to get started.
              </p>
            </div>
          )}
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {selectedAgent ? "Edit AI Agent" : "Add New AI Agent"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label
                htmlFor="name"
                className="text-right"
              >
                Name
              </Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label
                htmlFor="assistantId"
                className="text-right"
              >
                Assistant ID
              </Label>
              <Input
                id="assistantId"
                name="assistantId"
                value={formData.assistantId}
                onChange={handleInputChange}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label
                htmlFor="specialization"
                className="text-right"
              >
                Specialization
              </Label>
              <Input
                id="specialization"
                name="specialization"
                value={formData.specialization}
                onChange={handleInputChange}
                className="col-span-3"
                placeholder="Enter comma-separated specializations"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label
                htmlFor="description"
                className="text-right"
              >
                Description
              </Label>
              <Textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                className="col-span-3"
                rows={4}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label
                htmlFor="visitCost"
                className="text-right"
              >
                Visit Cost
              </Label>
              <Input
                id="visitCost"
                name="visitCost"
                type="number"
                value={formData.visitCost}
                onChange={handleInputChange}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit}>
              {selectedAgent ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AIAgentManagement;
