import { AircraftForm } from "@/components/flight/aircraft/AircraftForm";

export default function NewAircraftPage() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">機体を登録</h1>
      <AircraftForm />
    </div>
  );
}
