import React, { useState, useEffect } from "react";
import AIConsultCard from "./AIConsultCard";
import { Input } from "@/components/ui/input";
import { Bot, Search, Filter, Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import useActorStore from "@/State/Actors/ActorStore";

const ListAI = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [specialty, setSpecialty] = useState("all");
  const [aiAgents, setAiAgents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const { aiAgentSystem } = useActorStore();

  useEffect(() => {
    const fetchAIAgents = async () => {
      try {
        if (!aiAgentSystem) {
          setError("AI Agent system not initialized");
          setIsLoading(false);
          return;
        }

        const agents = await aiAgentSystem.getAllAIAgents();

        const formattedAgents = agents.map((agent) => ({
          id: agent.id,
          name: agent.name,
          assistantId: agent.assistantId,
          avatar: "https://example.com/ai-avatar-1.jpg", // Default avatar
          rating: 4.8, // Default rating
          reviewCount: 145, // Default review count
          specialties: agent.specialization,
          description: agent.description,
          consultationFee: Number(agent.visitCost),
        }));

        setAiAgents(formattedAgents);
        setIsLoading(false);
      } catch (error) {
        console.error("Error fetching AI agents:", error);
        setError("Failed to load AI agents");
        setIsLoading(false);
      }
    };

    fetchAIAgents();
  }, [aiAgentSystem]);

  // Filtering function
  const filteredAgents = aiAgents.filter((agent) => {
    const matchesSearch =
      agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agent.specialties.some((spec) =>
        spec.toLowerCase().includes(searchTerm.toLowerCase())
      );

    const matchesSpecialty =
      specialty === "all" ||
      agent.specialties.some((spec) =>
        spec.toLowerCase().includes(specialty.toLowerCase())
      );

    return matchesSearch && matchesSpecialty;
  });

  // Get all unique specialties for filter dropdown
  const allSpecialties = aiAgents
    .flatMap((agent) => agent.specialties)
    .filter((value, index, self) => self.indexOf(value) === index);

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="flex flex-col items-center text-center gap-3 mb-6">
        <div className="bg-gradient-to-br from-blue-500/20 to-purple-500/20 p-3 rounded-xl">
          <Bot className="w-8 h-8 text-blue-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            AI Medical Consultants
          </h1>
          <p className="text-muted-foreground">
            Get instant medical advice from our AI specialists
          </p>
        </div>
      </div>

      {/* Search and Filter Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="md:col-span-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search AI consultants by name or specialty..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="relative">
          <Select
            value={specialty}
            onValueChange={setSpecialty}
          >
            <SelectTrigger className="w-full">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Filter by Specialty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Specialties</SelectItem>
              {allSpecialties.map((specialty, index) => (
                <SelectItem
                  key={index}
                  value={specialty.toLowerCase()}
                >
                  {specialty}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Loading, Error or AI Consultants Grid */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Loading AI consultants...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-12 text-red-500">
          <p>{error}</p>
          <p className="text-sm text-muted-foreground mt-2">
            Please try again later
          </p>
        </div>
      ) : filteredAgents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground">
            No AI consultants found matching your criteria
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredAgents.map((agent) => (
            <AIConsultCard
              key={agent.id}
              agent={agent}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ListAI;
