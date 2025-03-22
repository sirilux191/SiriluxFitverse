import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function RegisteredContent2() {
  const navigate = useNavigate();

  useEffect(() => {
    const timeout = setTimeout(() => {
      navigate("/Health-Professional/Home"); //For Demo only
    }, 5000); // 5000 milliseconds = 5 seconds

    return () => clearTimeout(timeout);
  }, [navigate]);

  return (
    <section className="px-6 flex justify-center items-center h-screen bg-gradient-to-br from-green-800 via-green-900 to-slate-900">
      <div className="flex flex-col lg:flex-row h-1/2 md:w-1/2">
        <div className="flex-1 flex flex-col justify-center text-white p-4">
          <div className="flex items-center mb-4">
            <img
              alt="Logo"
              className="h-10 w-48"
              src="/assets/SiriluxHealthCare.png"
            />
          </div>
          <p className="text-xl md:text-2xl">
            Access, Analyze, and Amplify your fitness journey.
          </p>
        </div>

        <div className="flex-1 items-center max-w-md bg-background rounded-lg p-8">
          <div className="mx-auto w-full p-8 flex flex-col items-center justify-center h-full">
            <img
              src="/assets/checkmark.png"
              alt="checkmark"
              className="text-primary w-24 h-24"
            />
            <h2 className="mt-6 text-2xl text-center font-semibold">
              You have successfully registered!
            </h2>
          </div>
        </div>
      </div>
    </section>
  );
}
