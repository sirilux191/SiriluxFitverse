import React, { useState } from "react";
import AIConsultCard from "./AIConsultCard";
import { Input } from "@/components/ui/input";
import { Bot, Search, Filter } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Sample data - replace with actual data from your backend
const aiAgents = [
  {
    id: 1,
    name: "Dr. AI Smith",
    avatar: "https://example.com/ai-avatar-1.jpg",
    rating: 4.8,
    reviewCount: 245,
    specialties: ["General Medicine", "Preventive Care", "Health Analysis"],
    description:
      "Advanced AI medical assistant specialized in general healthcare consultation and preventive medicine. Available 24/7 for your health concerns.",
    consultationFee: 29.99,
  },
  {
    id: 2,
    name: "AI Health Assistant Pro",
    avatar: "https://example.com/ai-avatar-2.jpg",
    rating: 4.9,
    reviewCount: 189,
    specialties: ["Symptom Analysis", "Medical Advice", "Emergency Triage"],
    description:
      "Expert AI system trained on extensive medical data to provide accurate symptom analysis and preliminary medical advice.",
    consultationFee: 34.99,
  },
  // Add more AI agents as needed
];

const ListAI = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [specialty, setSpecialty] = useState("all");

  // Add this filtering function
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
              <SelectItem value="general">General Medicine</SelectItem>
              <SelectItem value="emergency">Emergency Care</SelectItem>
              <SelectItem value="preventive">Preventive Care</SelectItem>
              <SelectItem value="analysis">Health Analysis</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* AI Consultants Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredAgents.map((agent) => (
          <AIConsultCard
            key={agent.id}
            agent={agent}
          />
        ))}
      </div>
    </div>
  );
};

export default ListAI;
