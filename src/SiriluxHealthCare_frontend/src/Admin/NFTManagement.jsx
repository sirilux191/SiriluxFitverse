import React, { useState, useContext } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { toast } from "@/components/ui/use-toast";
import useActorStore from "../State/Actors/ActorStore";

function NFTManagement() {
  const { actors } = useActorStore();
  const [userPrincipal, setUserPrincipal] = useState("");
  const [avatarType, setAvatarType] = useState("");
  const [professionalType, setProfessionalType] = useState("");
  const [facilityType, setFacilityType] = useState("");
  const [message, setMessage] = useState("");
  const [imageURL, setImageURL] = useState(
    "https://gateway.lighthouse.storage/ipfs/bafkreihhnhf2wasvj7r3gywekm3lpgbiulpov6xwhcv2var2am4c3fn6wm"
  );

  const handleMintAvatar = async () => {
    if (!userPrincipal || !avatarType || !imageURL) {
      setMessage("Please fill in all fields including the image URL");
      return;
    }

    try {
      const avatarTypeVariant = { [avatarType]: null };
      const result = await actors.gamificationSystem.mintWellnessAvatar(
        userPrincipal,
        [],
        avatarTypeVariant,
        imageURL
      );

      if (result[0]?.Ok) {
        toast({
          title: "Avatar NFT minted successfully",
          description: `NFT minted successfully for ${userPrincipal}`,
        });
      } else {
        const error = result[0]?.Err || result[0]?.GenericError;
        toast({
          title: "Error minting Avatar NFT",
          description: error?.message || "Unknown error occurred",
        });
      }
    } catch (error) {
      console.error("Error minting Avatar NFT:", error);
      toast({
        title: "Error minting Avatar NFT",
        description: "Error minting NFT. Please try again.",
      });
    }
  };

  const handleMintProfessional = async () => {
    if (!userPrincipal || !professionalType || !imageURL) {
      setMessage("Please fill in all fields including the image URL");
      return;
    }

    try {
      const professionalTypeVariant = { [professionalType]: null };
      const result = await actors.gamificationSystem.mintProfessionalNFT(
        userPrincipal,
        [],
        professionalTypeVariant,
        imageURL
      );

      if (result[0]?.Ok) {
        toast({
          title: "Professional NFT minted successfully",
          description: `NFT minted successfully for ${userPrincipal}`,
        });
      } else {
        const error = result[0]?.Err || result[0]?.GenericError;
        toast({
          title: "Error minting Professional NFT",
          description: error?.message || "Unknown error occurred",
        });
      }
    } catch (error) {
      console.error("Error minting Professional NFT:", error);
      toast({
        title: "Error minting Professional NFT",
        description: "Error minting NFT. Please try again.",
      });
    }
  };

  const handleMintFacility = async () => {
    if (!userPrincipal || !facilityType || !imageURL) {
      setMessage("Please fill in all fields including the image URL");
      return;
    }

    try {
      const facilityTypeVariant = { [facilityType]: null };
      const result = await actors.gamificationSystem.mintFacilityNFT(
        userPrincipal,
        [],
        facilityTypeVariant,
        imageURL
      );

      if (result[0]?.Ok) {
        toast({
          title: "Facility NFT minted successfully",
          description: `NFT minted successfully for ${userPrincipal}`,
        });
      } else {
        const error = result[0]?.Err || result[0]?.GenericError;
        toast({
          title: "Error minting Facility NFT",
          description: error?.message || "Unknown error occurred",
        });
      }
    } catch (error) {
      console.error("Error minting Facility NFT:", error);
      toast({
        title: "Error minting Facility NFT",
        description: "Error minting NFT. Please try again.",
      });
    }
  };

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle>NFT Management</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs
          defaultValue="avatar"
          className="space-y-4"
        >
          <TabsList>
            <TabsTrigger value="avatar">Avatar</TabsTrigger>
            <TabsTrigger value="professional">Professional</TabsTrigger>
            <TabsTrigger value="facility">Facility</TabsTrigger>
          </TabsList>

          <Input
            placeholder="User Principal ID"
            value={userPrincipal}
            onChange={(e) => setUserPrincipal(e.target.value)}
            className="mb-4"
          />

          <Input
            placeholder="Image URL"
            value={imageURL}
            onChange={(e) => setImageURL(e.target.value)}
            className="mb-4"
          />

          <TabsContent value="avatar">
            <Select onValueChange={setAvatarType}>
              <SelectTrigger>
                <SelectValue placeholder="Select Avatar Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FitnessChampion">
                  Fitness Champion
                </SelectItem>
                <SelectItem value="MetabolicMaestro">
                  Metabolic Maestro
                </SelectItem>
                <SelectItem value="StressBuster">Stress Buster</SelectItem>
                <SelectItem value="MindfulnessMaster">
                  Mindfulness Master
                </SelectItem>
                <SelectItem value="PosturePro">Posture Pro</SelectItem>
                <SelectItem value="SleepOptimizer">Sleep Optimizer</SelectItem>
                <SelectItem value="NutritionExpert">
                  Nutrition Expert
                </SelectItem>
                <SelectItem value="ImmuneGuardian">Immune Guardian</SelectItem>
                <SelectItem value="AgingGracefully">
                  Aging Gracefully
                </SelectItem>
                <SelectItem value="HolisticHealer">Holistic Healer</SelectItem>
                <SelectItem value="RecoveryWarrior">
                  Recovery Warrior
                </SelectItem>
                <SelectItem value="ChronicCareChampion">
                  Chronic Care Champion
                </SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={handleMintAvatar}
              className="mt-4"
            >
              Mint Avatar NFT
            </Button>
          </TabsContent>

          <TabsContent value="professional">
            <Select onValueChange={setProfessionalType}>
              <SelectTrigger>
                <SelectValue placeholder="Select Professional Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PhysicalTrainer">
                  Physical Trainer
                </SelectItem>
                <SelectItem value="SportsMedicineExpert">
                  Sports Medicine Expert
                </SelectItem>
                <SelectItem value="FitnessInstructor">
                  Fitness Instructor
                </SelectItem>
                <SelectItem value="MentalHealthExpert">
                  Mental Health Expert
                </SelectItem>
                <SelectItem value="MeditationGuide">
                  Meditation Guide
                </SelectItem>
                <SelectItem value="CognitiveBehaviorist">
                  Cognitive Behaviorist
                </SelectItem>
                <SelectItem value="NutritionalAdvisor">
                  Nutritional Advisor
                </SelectItem>
                <SelectItem value="FunctionalMedicineExpert">
                  Functional Medicine Expert
                </SelectItem>
                <SelectItem value="PreventiveCareSpecialist">
                  Preventive Care Specialist
                </SelectItem>
                <SelectItem value="RehabilitationTherapist">
                  Rehabilitation Therapist
                </SelectItem>
                <SelectItem value="ChronicCareSpecialist">
                  Chronic Care Specialist
                </SelectItem>
                <SelectItem value="RecoveryExpert">Recovery Expert</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={handleMintProfessional}
              className="mt-4"
            >
              Mint Professional NFT
            </Button>
          </TabsContent>

          <TabsContent value="facility">
            <Select onValueChange={setFacilityType}>
              <SelectTrigger>
                <SelectValue placeholder="Select Facility Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FitnessCenter">Fitness Center</SelectItem>
                <SelectItem value="SportsMedicineFacility">
                  Sports Medicine Facility
                </SelectItem>
                <SelectItem value="AthleticTrainingCenter">
                  Athletic Training Center
                </SelectItem>
                <SelectItem value="MentalHealthClinic">
                  Mental Health Clinic
                </SelectItem>
                <SelectItem value="MeditationCenter">
                  Meditation Center
                </SelectItem>
                <SelectItem value="CognitiveCareCenter">
                  Cognitive Care Center
                </SelectItem>
                <SelectItem value="NutritionCenter">
                  Nutrition Center
                </SelectItem>
                <SelectItem value="WellnessRetreat">
                  Wellness Retreat
                </SelectItem>
                <SelectItem value="PreventiveHealthCenter">
                  Preventive Health Center
                </SelectItem>
                <SelectItem value="RehabilitationHospital">
                  Rehabilitation Hospital
                </SelectItem>
                <SelectItem value="RecoveryCenter">Recovery Center</SelectItem>
                <SelectItem value="ChronicCareClinic">
                  Chronic Care Clinic
                </SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={handleMintFacility}
              className="mt-4"
            >
              Mint Facility NFT
            </Button>
          </TabsContent>
        </Tabs>

        {message && <p className="text-sm text-gray-600 mt-4">{message}</p>}
      </CardContent>
    </Card>
  );
}

export default NFTManagement;
