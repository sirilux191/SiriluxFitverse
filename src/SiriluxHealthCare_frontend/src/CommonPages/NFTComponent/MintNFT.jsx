import React, { useState, useEffect } from "react";
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
import useActorStore from "../../State/Actors/ActorStore";
import useNFTStore from "../../State/CryptoAssets/NFTStore";

// NFT image URLs mapped from GamificationTypes.mo
const nftImages = {
  avatar: {
    FitnessChampion:
      "https://gateway.lighthouse.storage/ipfs/bafkreiewezorjawfvdy57upgea5pbazdv7abvhkyqny5bdkangaovip23u",
    MetabolicMaestro:
      "https://gateway.lighthouse.storage/ipfs/bafkreiahak56opnjpcjcqj3gcme7temijd66g5jpjjukixvsjno2kseszu",
    StressBuster:
      "https://gateway.lighthouse.storage/ipfs/bafkreiapeeri6gifrfad3n7skecmafiykteuctzzkqd7rhu4ogluorcdiy",
    MindfulnessMaster:
      "https://gateway.lighthouse.storage/ipfs/bafkreicltg77gjnfbsd4oglujhoetssm3rxz52kfrn4uxdxza4cdyqs2qy",
    PosturePro:
      "https://gateway.lighthouse.storage/ipfs/bafkreifwq6p7xhrcfexyavtfbijs356bglfdjdznkinjkv6bvfvss7rrjq",
    SleepOptimizer:
      "https://gateway.lighthouse.storage/ipfs/bafkreia4c5g4pn542te2hzt63x7vbxbwlto5mmk4w4rwr7hy7oq3fxng44",
    NutritionExpert:
      "https://gateway.lighthouse.storage/ipfs/bafkreidoq7gs3ib7ddar46gz2yowrlvuzce5uojwwfo2s5nyom4ygcmwuq",
    ImmuneGuardian:
      "https://gateway.lighthouse.storage/ipfs/bafkreihipoewmrsggqh2p2xrvjyqv5jslxn5jjx72wm5q6z76ji4rib3pe",
    AgingGracefully:
      "https://gateway.lighthouse.storage/ipfs/bafkreigr32fgzqmyzsofpcux4b3miv5uweopbbz42vb35fflofj4i7gb4a",
    HolisticHealer:
      "https://gateway.lighthouse.storage/ipfs/bafkreiff2z2ogqazgx5s4zltopm6y7oakmoxceqzqpigq3nn3p24abvp6q",
    RecoveryWarrior:
      "https://gateway.lighthouse.storage/ipfs/bafkreifce2jye7dwksjie27zvm4izvcj723tqfmjtx4vtoicqdflidihb4",
    ChronicCareChampion:
      "https://gateway.lighthouse.storage/ipfs/bafkreic5m32he2yulurw45pwlxmhe2vpvct4z6xavn2viptwsi5jzexym4",
  },
  professional: {
    PhysicalTrainer:
      "https://gateway.lighthouse.storage/ipfs/bafkreidawfxlmhecmdtcpqfwfs3daous2b7zjnx2we55l77ege6l75bzrm",
    SportsMedicineExpert:
      "https://gateway.lighthouse.storage/ipfs/bafkreieey25yk4laryxkrmveklfcdvvabtfunxgo7cgavanezdo6vnfefy",
    FitnessInstructor:
      "https://gateway.lighthouse.storage/ipfs/bafkreibibedzp2gzco33wdctw7u3tliq7tatmcve7aokokbuaje7up5fgy",
    MentalHealthExpert:
      "https://gateway.lighthouse.storage/ipfs/bafkreihaax3keu3ojes3rciil66ha2nwia77t2sjtl326p7lexpebjnl5m",
    MeditationGuide:
      "https://gateway.lighthouse.storage/ipfs/bafkreicys22xnkfwiqjzaij5r3yfnzx3iardhlscs7kf6qooqgbtd5ex7q",
    CognitiveBehaviorist:
      "https://gateway.lighthouse.storage/ipfs/bafkreibaazatemrqlevlj7vtwz367im6gesxpuoionkqqdve25andqsil4",
    NutritionalAdvisor:
      "https://gateway.lighthouse.storage/ipfs/bafkreihc62uzsvjivkypqpdry6p6f3fue2rp3mzya6kt6ieqwettrzjrg4",
    FunctionalMedicineExpert:
      "https://gateway.lighthouse.storage/ipfs/bafkreiegloypyv5vrhqudmbvnlfuzvl7tr4nmih6akgfscrduqsqarwp6q",
    PreventiveCareSpecialist:
      "https://gateway.lighthouse.storage/ipfs/bafkreicycbt56vd4wtcrhdp3kc3bkme3mfvcbypvfdjaidvsonjlkm67ii",
    RehabilitationTherapist:
      "https://gateway.lighthouse.storage/ipfs/bafkreicml77brda47nzhgmommfp572u22d64jvasi4e2lgj5qugeoosvxe",
    ChronicCareSpecialist:
      "https://gateway.lighthouse.storage/ipfs/bafkreifufdemtjo6r3xwdhctlawjjugo7ebvnn6l43fpaggu4h63hsdxua",
    RecoveryExpert:
      "https://gateway.lighthouse.storage/ipfs/bafkreidib3fl2jf4kcwnrnextydwdbhbgmhl5jzn5pn4e477ze42czv76y",
  },
  facility: {
    FitnessCenter:
      "https://gateway.lighthouse.storage/ipfs/bafkreihkuhmrwziltq7lohnbdgxdl7kc5aaiswvwut6zw2nv6h3xbafvfq",
    SportsMedicineFacility:
      "https://gateway.lighthouse.storage/ipfs/bafkreid4detbmswupi6mtcdc4lobbib5hictue6427heu5a7fxtfwnoyti",
    AthleticTrainingCenter:
      "https://gateway.lighthouse.storage/ipfs/bafkreiciano5umt6epzfbx66tfzbzbqxnh36ushnwj4iflzo3emoh4glqy",
    MentalHealthClinic:
      "https://gateway.lighthouse.storage/ipfs/bafkreibq773itck2wcfosxp44t42mfwvsz6wijhhb7a3qkhevl2uerl6pe",
    MeditationCenter:
      "https://gateway.lighthouse.storage/ipfs/bafkreibsceqbccykkw5a5yx45sow5cnzw5v3oafxxkjuhprks2ymru2p5e",
    CognitiveCareCenter:
      "https://gateway.lighthouse.storage/ipfs/bafkreidu5vg36hsixuwgilnclcpc5hpvhxfhclbfpxflb6pnbaug5vtvte",
    NutritionCenter:
      "https://gateway.lighthouse.storage/ipfs/bafkreieasr2vjvnudyaabuyao47q7s6ue5e7kyg2cn3i66wsib7vrmvc3m",
    WellnessRetreat:
      "https://gateway.lighthouse.storage/ipfs/bafkreigotqhidajlayz37qfgcw4arexn275vg2gg6kukdpaprxt3phv764",
    PreventiveHealthCenter:
      "https://gateway.lighthouse.storage/ipfs/bafkreiazdcjb5jsichjkfgvg4tilktclyjfvvps762vdpqld4zpsbbibjy",
    RehabilitationHospital:
      "https://gateway.lighthouse.storage/ipfs/bafkreidxc7teeckoc442jlrmvz5p72n47qojtxsnuioigq7lbavw3kq4py",
    RecoveryCenter:
      "https://gateway.lighthouse.storage/ipfs/bafkreidy3udhvun5z7z6tc4ezhsgxhzszlnskz5smuyutmrvf56sxjlane",
    ChronicCareClinic:
      "https://gateway.lighthouse.storage/ipfs/bafkreibxt4zhuskcpx3oclpuaza5snmcfyphj37n4dpjufgy4dpcqzsrfu",
  },
};

// NFT attribute descriptions
const nftAttributes = {
  avatar: {
    FitnessChampion: {
      energy: 100,
      focus: 70,
      vitality: 80,
      resilience: 70,
      primaryAttribute: "energy",
    },
    MetabolicMaestro: {
      energy: 90,
      focus: 70,
      vitality: 90,
      resilience: 70,
      primaryAttribute: "energy",
    },
    StressBuster: {
      energy: 90,
      focus: 80,
      vitality: 70,
      resilience: 80,
      primaryAttribute: "energy",
    },
    MindfulnessMaster: {
      energy: 70,
      focus: 100,
      vitality: 70,
      resilience: 80,
      primaryAttribute: "focus",
    },
    PosturePro: {
      energy: 80,
      focus: 90,
      vitality: 70,
      resilience: 80,
      primaryAttribute: "focus",
    },
    SleepOptimizer: {
      energy: 70,
      focus: 90,
      vitality: 80,
      resilience: 80,
      primaryAttribute: "focus",
    },
    NutritionExpert: {
      energy: 70,
      focus: 80,
      vitality: 100,
      resilience: 70,
      primaryAttribute: "vitality",
    },
    ImmuneGuardian: {
      energy: 70,
      focus: 70,
      vitality: 90,
      resilience: 90,
      primaryAttribute: "vitality",
    },
    AgingGracefully: {
      energy: 70,
      focus: 80,
      vitality: 90,
      resilience: 80,
      primaryAttribute: "vitality",
    },
    HolisticHealer: {
      energy: 70,
      focus: 80,
      vitality: 80,
      resilience: 90,
      primaryAttribute: "resilience",
    },
    RecoveryWarrior: {
      energy: 80,
      focus: 70,
      vitality: 70,
      resilience: 100,
      primaryAttribute: "resilience",
    },
    ChronicCareChampion: {
      energy: 70,
      focus: 70,
      vitality: 90,
      resilience: 90,
      primaryAttribute: "resilience",
    },
  },
  professional: {
    PhysicalTrainer: {
      experience: 100,
      reputation: 100,
      primaryAttribute: "energy",
    },
    SportsMedicineExpert: {
      experience: 100,
      reputation: 100,
      primaryAttribute: "energy",
    },
    FitnessInstructor: {
      experience: 100,
      reputation: 100,
      primaryAttribute: "energy",
    },
    MentalHealthExpert: {
      experience: 100,
      reputation: 100,
      primaryAttribute: "focus",
    },
    MeditationGuide: {
      experience: 100,
      reputation: 100,
      primaryAttribute: "focus",
    },
    CognitiveBehaviorist: {
      experience: 100,
      reputation: 100,
      primaryAttribute: "focus",
    },
    NutritionalAdvisor: {
      experience: 100,
      reputation: 100,
      primaryAttribute: "vitality",
    },
    FunctionalMedicineExpert: {
      experience: 100,
      reputation: 100,
      primaryAttribute: "vitality",
    },
    PreventiveCareSpecialist: {
      experience: 100,
      reputation: 100,
      primaryAttribute: "vitality",
    },
    RehabilitationTherapist: {
      experience: 100,
      reputation: 100,
      primaryAttribute: "resilience",
    },
    ChronicCareSpecialist: {
      experience: 100,
      reputation: 100,
      primaryAttribute: "resilience",
    },
    RecoveryExpert: {
      experience: 100,
      reputation: 100,
      primaryAttribute: "resilience",
    },
  },
  facility: {
    FitnessCenter: {
      technologyLevel: 10,
      reputation: 100,
      primaryAttribute: "energy",
    },
    SportsMedicineFacility: {
      technologyLevel: 10,
      reputation: 100,
      primaryAttribute: "energy",
    },
    AthleticTrainingCenter: {
      technologyLevel: 10,
      reputation: 100,
      primaryAttribute: "energy",
    },
    MentalHealthClinic: {
      technologyLevel: 10,
      reputation: 100,
      primaryAttribute: "focus",
    },
    MeditationCenter: {
      technologyLevel: 10,
      reputation: 100,
      primaryAttribute: "focus",
    },
    CognitiveCareCenter: {
      technologyLevel: 10,
      reputation: 100,
      primaryAttribute: "focus",
    },
    NutritionCenter: {
      technologyLevel: 10,
      reputation: 100,
      primaryAttribute: "vitality",
    },
    WellnessRetreat: {
      technologyLevel: 10,
      reputation: 100,
      primaryAttribute: "vitality",
    },
    PreventiveHealthCenter: {
      technologyLevel: 10,
      reputation: 100,
      primaryAttribute: "vitality",
    },
    RehabilitationHospital: {
      technologyLevel: 10,
      reputation: 100,
      primaryAttribute: "resilience",
    },
    RecoveryCenter: {
      technologyLevel: 10,
      reputation: 100,
      primaryAttribute: "resilience",
    },
    ChronicCareClinic: {
      technologyLevel: 10,
      reputation: 100,
      primaryAttribute: "resilience",
    },
  },
};

function MintNFT() {
  const { gamificationSystem } = useActorStore();
  const { mintNFT } = useNFTStore();
  const [userPrincipal, setUserPrincipal] = useState("");
  const [avatarType, setAvatarType] = useState("");
  const [professionalType, setProfessionalType] = useState("");
  const [facilityType, setFacilityType] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentTab, setCurrentTab] = useState("avatar");

  // Get the selected type based on current tab
  const getSelectedType = () => {
    switch (currentTab) {
      case "avatar":
        return avatarType;
      case "professional":
        return professionalType;
      case "facility":
        return facilityType;
      default:
        return "";
    }
  };

  // Get the preview image URL based on current selection
  const getPreviewImageURL = () => {
    const selectedType = getSelectedType();
    if (!selectedType) return null;
    return nftImages[currentTab][selectedType];
  };

  // Get attributes for the preview
  const getAttributes = () => {
    const selectedType = getSelectedType();
    if (!selectedType) return null;
    return nftAttributes[currentTab][selectedType];
  };

  const handleTabChange = (value) => {
    setCurrentTab(value);
    setMessage("");
  };

  const handleMint = async () => {
    if (!userPrincipal) {
      setMessage("Please enter a user principal ID");
      return;
    }

    const selectedType = getSelectedType();
    if (!selectedType) {
      setMessage(`Please select a ${currentTab} type`);
      return;
    }

    setIsLoading(true);
    try {
      // Use the NFT store's mintNFT function instead of direct actor calls
      const result = await mintNFT(userPrincipal, currentTab, selectedType);

      if (result.success) {
        toast({
          title: result.message,
          description: `NFT minted successfully for ${userPrincipal}`,
        });
        // Reset form after successful mint
        if (currentTab === "avatar") setAvatarType("");
        else if (currentTab === "professional") setProfessionalType("");
        else if (currentTab === "facility") setFacilityType("");
      } else {
        toast({
          title: `Error minting ${currentTab} NFT`,
          description: result.message || "Unknown error occurred",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error(`Error minting ${currentTab} NFT:`, error);
      toast({
        title: `Error minting ${currentTab} NFT`,
        description: "Error minting NFT. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Render attribute badges
  const renderAttributeBadges = (attributes) => {
    if (!attributes) return null;

    return (
      <div className="flex flex-wrap gap-2 mt-4">
        {Object.entries(attributes).map(([key, value]) => {
          if (key === "primaryAttribute") return null;

          // Highlight the primary attribute
          const isPrimary = attributes.primaryAttribute === key;

          return (
            <div
              key={key}
              className={`px-3 py-1 rounded-full text-sm ${
                isPrimary
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "bg-secondary text-secondary-foreground"
              }`}
            >
              {key.charAt(0).toUpperCase() + key.slice(1)}: {value}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Card className="mt-8">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>NFT Minting</CardTitle>
          <Button
            variant="outline"
            onClick={() => window.history.back()}
            size="sm"
          >
            Go Back
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs
          defaultValue="avatar"
          value={currentTab}
          onValueChange={handleTabChange}
          className="space-y-4"
        >
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="avatar">Avatar</TabsTrigger>
            <TabsTrigger value="professional">Professional</TabsTrigger>
            <TabsTrigger value="facility">Facility</TabsTrigger>
          </TabsList>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <Input
                placeholder="User Principal ID"
                value={userPrincipal}
                onChange={(e) => setUserPrincipal(e.target.value)}
              />

              <TabsContent
                value="avatar"
                className="mt-0 space-y-4"
              >
                <Select
                  value={avatarType}
                  onValueChange={setAvatarType}
                >
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
                    <SelectItem value="SleepOptimizer">
                      Sleep Optimizer
                    </SelectItem>
                    <SelectItem value="NutritionExpert">
                      Nutrition Expert
                    </SelectItem>
                    <SelectItem value="ImmuneGuardian">
                      Immune Guardian
                    </SelectItem>
                    <SelectItem value="AgingGracefully">
                      Aging Gracefully
                    </SelectItem>
                    <SelectItem value="HolisticHealer">
                      Holistic Healer
                    </SelectItem>
                    <SelectItem value="RecoveryWarrior">
                      Recovery Warrior
                    </SelectItem>
                    <SelectItem value="ChronicCareChampion">
                      Chronic Care Champion
                    </SelectItem>
                  </SelectContent>
                </Select>
              </TabsContent>

              <TabsContent
                value="professional"
                className="mt-0 space-y-4"
              >
                <Select
                  value={professionalType}
                  onValueChange={setProfessionalType}
                >
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
                    <SelectItem value="RecoveryExpert">
                      Recovery Expert
                    </SelectItem>
                  </SelectContent>
                </Select>
              </TabsContent>

              <TabsContent
                value="facility"
                className="mt-0 space-y-4"
              >
                <Select
                  value={facilityType}
                  onValueChange={setFacilityType}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Facility Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FitnessCenter">
                      Fitness Center
                    </SelectItem>
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
                    <SelectItem value="RecoveryCenter">
                      Recovery Center
                    </SelectItem>
                    <SelectItem value="ChronicCareClinic">
                      Chronic Care Clinic
                    </SelectItem>
                  </SelectContent>
                </Select>
              </TabsContent>

              <Button
                onClick={handleMint}
                disabled={isLoading || !userPrincipal || !getSelectedType()}
                className="w-full"
              >
                {isLoading
                  ? "Minting..."
                  : `Mint ${currentTab.charAt(0).toUpperCase() + currentTab.slice(1)} NFT`}
              </Button>

              {message && <p className="text-sm text-red-500">{message}</p>}
            </div>

            <div className="border rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-2">NFT Preview</h3>

              {getPreviewImageURL() ? (
                <div className="space-y-4">
                  <div className="relative aspect-square overflow-hidden rounded-lg border">
                    <img
                      src={getPreviewImageURL()}
                      alt={`${getSelectedType()} preview`}
                      className="object-cover w-full h-full"
                    />
                  </div>

                  <div>
                    <h4 className="font-medium">{getSelectedType()}</h4>
                    <p className="text-sm text-muted-foreground">
                      {currentTab === "avatar" && "Wellness Avatar"}
                      {currentTab === "professional" &&
                        "Healthcare Professional"}
                      {currentTab === "facility" && "Healthcare Facility"}
                    </p>

                    <div className="mt-2">
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                        Common Quality
                      </span>
                    </div>

                    {renderAttributeBadges(getAttributes())}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-64 bg-muted rounded-lg">
                  <p className="text-muted-foreground">
                    Select a {currentTab} type to see preview
                  </p>
                </div>
              )}
            </div>
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default MintNFT;
