import { AvatarImage, AvatarFallback, Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  SelectValue,
  SelectTrigger,
  SelectItem,
  SelectContent,
  Select,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

import { useState, useEffect } from "react";
import LoadingScreen from "../../LoadingScreen";
import { toast } from "@/components/ui/use-toast";
import useActorStore from "../../State/Actors/ActorStore";
export default function ProfileContent() {
  const { professional } = useActorStore();
  const [professionalData, setProfessionalData] = useState(null);
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [bloodType, setBloodType] = useState("");
  const [height, setHeight] = useState("");
  const [country, setCountry] = useState("");
  const [weight, setWeight] = useState("");
  const [state, setState] = useState("");
  const [heartRate, setHeartRate] = useState("");
  const [pincode, setPincode] = useState("");
  const [occupation, setOccupation] = useState("");
  const [certificationId, setCertificationId] = useState("");
  const [company, setCompany] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchProfessionalData = async () => {
      try {
        const result = await professional.getProfessionalInfo();
        console.log(professional);
        console.log(professional.getProfessionalInfo());
        console.log(result);
        if (result.ok) {
          const { IDNum, UUID, MetaData } = result.ok;
          const {
            DemographicInformation,
            OccupationInformation,
            CertificationInformation,
          } = MetaData;

          const parsedDemographicInfo = JSON.parse(
            new TextDecoder().decode(DemographicInformation)
          );
          const parsedOccupationInfo = JSON.parse(
            new TextDecoder().decode(OccupationInformation)
          );
          const parsedCertificationInfo = JSON.parse(
            new TextDecoder().decode(CertificationInformation)
          );

          setProfessionalData({
            IDNum,
            UUID,
            DemographicInformation: parsedDemographicInfo,
            OccupationInformation: parsedOccupationInfo,
            CertificationInformation: parsedCertificationInfo,
          });
        } else {
          alert("Error fetching professional data:", result.err);
        }
      } catch (error) {
        console.error("Error fetching professional data:", error);
      }
    };

    fetchProfessionalData();
  }, [professional]);

  useEffect(() => {
    if (professionalData) {
      setName(professionalData.DemographicInformation.name || "");
      setDob(professionalData.DemographicInformation.dob || "");
      setGender(professionalData.DemographicInformation.gender || "");
      setBloodType(professionalData.DemographicInformation.bloodType || "");
      setHeight(professionalData.DemographicInformation.height || "");
      setCountry(professionalData.DemographicInformation.country || "");
      setWeight(professionalData.DemographicInformation.weight || "");
      setState(professionalData.DemographicInformation.state || "");
      setHeartRate(professionalData.DemographicInformation.heartRate || "");
      setPincode(professionalData.DemographicInformation.pincode || "");
      setOccupation(professionalData.OccupationInformation.occupation || "");
      setCompany(professionalData.OccupationInformation.company || "");
      setCertificationId(
        professionalData.CertificationInformation.certificationId || ""
      );
    }
  }, [professionalData]);

  const handleUpdateProfessional = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      const demoInfo = {
        name,
        dob,
        gender,
        bloodType,
        height,
        country,
        weight,
        state,
        heartRate,
        pincode,
      };

      const occupationInfo = {
        occupation,
        company,
      };

      const certificationInfo = {
        certificationId,
      };

      // Convert demoInfo, occupationInfo, and certificationInfo objects to JSON strings
      const demoInfoJson = JSON.stringify(demoInfo);
      const occupationInfoJson = JSON.stringify(occupationInfo);
      const certificationInfoJson = JSON.stringify(certificationInfo);

      // Convert JSON strings to Uint8Array
      const demoInfoArray = new TextEncoder().encode(demoInfoJson);
      const occupationInfoArray = new TextEncoder().encode(occupationInfoJson);
      const certificationInfoArray = new TextEncoder().encode(
        certificationInfoJson
      );

      const result = await professional.updateProfessionalInfo(
        Object.values(demoInfoArray),
        Object.values(occupationInfoArray),
        Object.values(certificationInfoArray)
      );
      Object.keys(result).forEach((key) => {
        if (key == "err") {
          console.log(result[key]);
          toast({
            title: "Error",
            description: result[key],
          });
          setLoading(false);
        }
        if (key == "ok") {
          toast({
            title: "Success",
            description: result[key],
          });
          setLoading(false);
        }
      });
    } catch (error) {
      console.error("Error updating professional data:", error);
    }
  };
  if (loading) {
    return <LoadingScreen />;
  }
  if (!professionalData) {
    return <LoadingScreen />;
  }

  return (
    <div>
      <div className="h-min py-8 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-screen-sm">
          <h1 className="text-center text-4xl font-bold leading-9 ">
            Update Profile
          </h1>
          <p className="mt-2 text-center text-sm leading-5 text-gray-600">
            Update your Profile Information
          </p>
          <form
            className="mt-8"
            onSubmit={handleUpdateProfessional}
          >
            <div className="rounded-md shadow-sm">
              <div className="flex flex-col items-center">
                <Avatar className="-z-10 w-36 h-36">
                  <AvatarImage
                    alt="John Lenon"
                    src=""
                  />
                  <AvatarFallback className="text-4xl">JL</AvatarFallback>
                </Avatar>

                <div className="flex space-x-2 py-4">
                  <p>ID Number:- {professionalData.IDNum}</p>
                  <p>UUID:- {professionalData.UUID}</p>
                </div>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-y-6 gap-x-4 ">
                <div>
                  <label
                    className="block text-sm font-medium leading-5 text-foreground"
                    htmlFor="name"
                  >
                    Name
                  </label>
                  <div className="mt-1">
                    <Input
                      id="name"
                      placeholder="Name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label
                    className="block text-sm font-medium leading-5 text-foreground"
                    htmlFor="dob"
                  >
                    Date of Birth
                  </label>
                  <div className="mt-1">
                    <Input
                      disabled
                      placeholder="Date Of Birth"
                      type="date"
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label
                    className="block text-sm font-medium leading-5 text-foreground"
                    htmlFor="gender"
                  >
                    Gender
                  </label>
                  <div className="mt-1">
                    <Select
                      value={gender}
                      onValueChange={setGender}
                    >
                      <SelectTrigger id="gender">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent position="popper">
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <label
                    className="block text-sm font-medium leading-5 text-foreground"
                    htmlFor="blood_type"
                  >
                    Blood Type
                  </label>
                  <div className="mt-1">
                    <Select
                      value={bloodType}
                      onValueChange={setBloodType}
                    >
                      <SelectTrigger id="blood_type">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent position="popper">
                        <SelectItem value="a+">A+</SelectItem>
                        <SelectItem value="a-">A-</SelectItem>
                        <SelectItem value="b+">B+</SelectItem>
                        <SelectItem value="b-">B-</SelectItem>
                        <SelectItem value="ab+">AB+</SelectItem>
                        <SelectItem value="ab-">AB-</SelectItem>
                        <SelectItem value="o+">O+</SelectItem>
                        <SelectItem value="o-">O-</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <label
                    className="block text-sm font-medium leading-5 text-foreground"
                    htmlFor="height"
                  >
                    Height
                  </label>
                  <div className="mt-1">
                    <Input
                      id="height"
                      placeholder="Height in cm"
                      value={height}
                      onChange={(e) => setHeight(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label
                    className="block text-sm font-medium leading-5 text-foreground"
                    htmlFor="country"
                  >
                    Country
                  </label>
                  <div className="mt-1">
                    <Input
                      id="country"
                      placeholder="Country"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label
                    className="block text-sm font-medium leading-5 text-foreground"
                    htmlFor="weight"
                  >
                    Weight
                  </label>
                  <div className="mt-1">
                    <Input
                      id="weight"
                      placeholder="Weight in Kg"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label
                    className="block text-sm font-medium leading-5 text-foreground"
                    htmlFor="state"
                  >
                    State
                  </label>
                  <div className="mt-1">
                    <Input
                      id="state"
                      placeholder="State"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label
                    className="block text-sm font-medium leading-5 text-foreground"
                    htmlFor="heartRate"
                  >
                    Heart Rate
                  </label>
                  <div className="mt-1">
                    <Input
                      id="heartRate"
                      placeholder="Heart Rate"
                      value={heartRate}
                      onChange={(e) => setHeartRate(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label
                    className="block text-sm font-medium leading-5 text-foreground"
                    htmlFor="pincode"
                  >
                    Pincode
                  </label>
                  <div className="mt-1">
                    <Input
                      id="pincode"
                      placeholder="Pincode"
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label
                    className="block text-sm font-medium leading-5 text-foreground"
                    htmlFor="occupation"
                  >
                    Occupation
                  </label>
                  <div className="mt-1">
                    <Input
                      id="occupation"
                      placeholder="Occupation"
                      value={occupation}
                      onChange={(e) => setOccupation(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label
                    className="block text-sm font-medium leading-5 text-foreground"
                    htmlFor="certificationid"
                  >
                    Certification Id
                  </label>
                  <div className="mt-1">
                    <Input
                      id="certificationid"
                      placeholder="Certification Id"
                      value={certificationId}
                      onChange={(e) => setCertificationId(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label
                    className="block text-sm font-medium leading-5 text-foreground"
                    htmlFor="company"
                  >
                    Company
                  </label>
                  <div className="mt-1">
                    <Input
                      id="company"
                      placeholder="Company"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-6">
              <Button
                className="w-full"
                type="submit"
              >
                Update
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
