import React, { useState, useContext } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { ChevronLeft } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import useActorStore from "../../State/Actors/ActorStore";
import LoadingScreen from "../../LoadingScreen";
import OnboardingBanner from "../../OnboardingBanner";
// import * as vetkd from "ic-vetkd-utils";
import { z } from "zod";

// Define the Zod schema
const formSchema = z.object({
  facultyName: z.string().min(1, "Faculty Name is required"),
  registrationId: z.string().min(1, "Registration ID is required"),
  country: z.string().optional(),
  state: z.string().optional(),
  city: z.string().optional(),
  pincode: z
    .string()
    .min(1, { message: "Pincode is required" })
    .regex(/^\d+$/, { message: "Pincode must contain only numbers" }),
  serviceName: z.string().min(1, "Service Name is required"),
  serviceDesc: z.string().optional(),
});

export default function RegisterPage3Content() {
  const { facility } = useActorStore();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    facultyName: "",
    registrationId: "",
    country: "",
    state: "",
    city: "",
    pincode: "",
    serviceName: "",
    serviceDesc: "",
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const handleInputChange = (e) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  const registerService = async () => {
    try {
      // Validate the form data
      formSchema.parse(formData);
      setErrors({});
      setLoading(true);

      const {
        facultyName,
        registrationId,
        country,
        state,
        city,
        pincode,
        serviceName,
        serviceDesc,
      } = formData;

      // Create the data objects
      const licenseInfo = {
        licenseId: registrationId,
      };
      const demographicInfo = {
        country,
        state,
        city,
        pincode,
        facilityName: facultyName, // Include facility name in demographic info
      };
      const servicesOfferedInfo = {
        serviceName,
        serviceDesc,
      };

      // Convert to JSON strings and then to Uint8Array
      const licenseInfoArray = new TextEncoder().encode(
        JSON.stringify(licenseInfo)
      );
      const demographicInfoArray = new TextEncoder().encode(
        JSON.stringify(demographicInfo)
      );
      const servicesOfferedInfoArray = new TextEncoder().encode(
        JSON.stringify(servicesOfferedInfo)
      );

      // Call the correct backend method
      const result = await facility.createFacilityRequest(
        licenseInfoArray,
        demographicInfoArray,
        servicesOfferedInfoArray
      );

      Object.keys(result).forEach((key) => {
        if (key == "err") {
          toast({
            title: "Error",
            description: result[key],
            variant: "destructive",
          });
          setLoading(false);
        }
        if (key == "ok") {
          toast({
            title: "Success",
            description: result[key],
            variant: "success",
          });
          setLoading(false);
          navigate("verify");
        }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMap = {};
        error.errors.forEach((err) => {
          errorMap[err.path[0]] = err.message;
        });
        setErrors(errorMap);
      } else {
        console.error("An unexpected error occurred:", error);
      }
      setLoading(false);
    }
  };

  // const aes_gcm_encrypt = async (data, rawKey) => {
  //   const iv = window.crypto.getRandomValues(new Uint8Array(12));
  //   const aes_key = await window.crypto.subtle.importKey(
  //     "raw",
  //     rawKey,
  //     "AES-GCM",
  //     false,
  //     ["encrypt"]
  //   );
  //   const ciphertext_buffer = await window.crypto.subtle.encrypt(
  //     { name: "AES-GCM", iv: iv },
  //     aes_key,
  //     data
  //   );
  //   const ciphertext = new Uint8Array(ciphertext_buffer);
  //   const iv_and_ciphertext = new Uint8Array(iv.length + ciphertext.length);
  //   iv_and_ciphertext.set(iv, 0);
  //   iv_and_ciphertext.set(ciphertext, iv.length);
  //   return iv_and_ciphertext;
  // };

  // const hex_decode = (hexString) =>
  //   Uint8Array.from(
  //     hexString.match(/.{1,2}/g).map((byte) => parseInt(byte, 16))
  //   );

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <section className="bg-[conic-gradient(at_bottom_right,_var(--tw-gradient-stops))] from-blue-700 via-blue-800 to-gray-900">
      <OnboardingBanner />
      <div className="px-6 flex justify-center items-center h-screen">
        <div className="flex flex-col lg:flex-row md:w-4/6">
          <div className="flex-1 flex flex-col justify-center text-white p-4">
            <div className="flex items-center mb-4">
              <img
                alt="Logo"
                className="h-10 w-48"
                src="/assets/SiriluxHealthCare.png"
              />
            </div>
            <p className="text-xl md:text-2xl">
              Digitally Linking your health.
            </p>
          </div>

          <div className="flex-1 items-center max-w-xl bg-background rounded-lg p-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl md:text-2xl font-bold">
                Register Service
              </h2>
              <Link to="/Register">
                <ChevronLeft />
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-4 py-4">
              <div>
                <label
                  className="block text-sm font-medium leading-5 text-foreground"
                  htmlFor="facultyName"
                >
                  Faculty Name *
                </label>
                <div className="mt-1">
                  <Input
                    id="facultyName"
                    placeholder="Faculty Name"
                    value={formData.facultyName}
                    onChange={handleInputChange}
                    required
                  />
                  {errors.facultyName && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.facultyName}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label
                  className="block text-sm font-medium leading-5 text-foreground"
                  htmlFor="registrationId"
                >
                  Registration ID *
                </label>
                <div className="mt-1">
                  <Input
                    id="registrationId"
                    placeholder="Registration ID"
                    value={formData.registrationId}
                    onChange={handleInputChange}
                    required
                  />
                  {errors.registrationId && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.registrationId}
                    </p>
                  )}
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
                    value={formData.country}
                    onChange={handleInputChange}
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
                    value={formData.state}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div>
                <label
                  className="block text-sm font-medium leading-5 text-foreground"
                  htmlFor="city"
                >
                  City
                </label>
                <div className="mt-1">
                  <Input
                    id="city"
                    placeholder="City"
                    value={formData.city}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div>
                <label
                  className="block text-sm font-medium leading-5 text-foreground"
                  htmlFor="pincode"
                >
                  Pincode *
                </label>
                <div className="mt-1">
                  <Input
                    id="pincode"
                    placeholder="Pincode"
                    value={formData.pincode}
                    onChange={handleInputChange}
                    required
                  />
                  {errors.pincode && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.pincode}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label
                  className="block text-sm font-medium leading-5 text-foreground"
                  htmlFor="serviceName"
                >
                  Service Name *
                </label>
                <div className="mt-1">
                  <Input
                    id="serviceName"
                    placeholder="Service Name"
                    value={formData.serviceName}
                    onChange={handleInputChange}
                    required
                  />
                  {errors.serviceName && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.serviceName}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label
                  className="block text-sm font-medium leading-5 text-foreground"
                  htmlFor="serviceDesc"
                >
                  Service Description
                </label>
                <div className="mt-1">
                  <Input
                    id="serviceDesc"
                    placeholder="Service Description"
                    value={formData.serviceDesc}
                    onChange={handleInputChange}
                  />
                </div>
              </div>
            </div>
            <Button
              className="w-full"
              onClick={registerService}
            >
              Submit
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
