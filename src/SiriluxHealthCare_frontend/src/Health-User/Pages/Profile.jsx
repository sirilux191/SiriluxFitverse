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
import useActorStore from "../../State/Actors/ActorStore";
import { useState, useEffect } from "react";
import LoadingScreen from "../../LoadingScreen";
import { toast } from "@/components/ui/use-toast";
import { useUserProfileStore } from "../../State/User/UserProfile/UserProfileStore";

export default function ProfileContent() {
  const { actors } = useActorStore();
  const { userProfile, loading, fetchUserProfile, updateUserProfile } =
    useUserProfileStore();

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

  useEffect(() => {
    fetchUserProfile(actors);
  }, [actors, fetchUserProfile]);

  useEffect(() => {
    if (userProfile) {
      setName(userProfile.DemographicInformation.name || "");
      setDob(userProfile.DemographicInformation.dob || "");
      setGender(userProfile.DemographicInformation.gender || "");
      setBloodType(userProfile.BasicHealthParameters.bloodType || "");
      setHeight(userProfile.BasicHealthParameters.height || "");
      setCountry(userProfile.DemographicInformation.country || "");
      setWeight(userProfile.BasicHealthParameters.weight || "");
      setState(userProfile.DemographicInformation.state || "");
      setHeartRate(userProfile.BasicHealthParameters.heartRate || "");
      setPincode(userProfile.DemographicInformation.pincode || "");
    }
  }, [userProfile]);

  const handleUpdateUser = async (event) => {
    event.preventDefault();

    const demoInfo = {
      name,
      dob,
      gender,
      country,
      state,
      pincode,
    };

    const basicHealthPara = {
      bloodType,
      height,
      heartRate,
      weight,
    };

    const result = await updateUserProfile(actors, demoInfo, basicHealthPara);

    if (result.success) {
      toast({
        title: "Success",
        description: result.message,
        variant: "success",
      });
    } else {
      toast({
        title: "Error",
        description: result.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <LoadingScreen />;
  }
  if (!userProfile) {
    return <LoadingScreen />;
  }
  return (
    <div>
      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto">
          <h1 className="text-center text-4xl font-bold leading-9 ">
            Update Profile
          </h1>
          <p className="mt-2 text-center text-sm leading-5 text-gray-600">
            Update your Profile Information
          </p>
          <form
            className="mt-8"
            onSubmit={handleUpdateUser}
          >
            <div className="rounded-md shadow-sm">
              <div className="flex flex-col items-center">
                <Avatar className="-z-10 w-36 h-36">
                  <AvatarImage
                    alt=""
                    src=""
                  />
                  <AvatarFallback className="text-4xl">
                    {name.charAt(0)}
                  </AvatarFallback>
                </Avatar>

                <div className="flex space-x-2 py-4">
                  <p>ID Number:- {userProfile.IDNum}</p>
                  <p>UUID:- {userProfile.UUID}</p>
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
                      className="border"
                      id="dob"
                      placeholder="mm/dd/yyyy"
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
