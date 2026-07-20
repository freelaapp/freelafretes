import { Package, PlusCircle, TruckIcon, User, Search, ListChecks, FileText } from "lucide-react";
import { BottomNav } from "./BottomNav";

export function ContractorNav() {
  return (
    <BottomNav
      items={[
        { to: "/embarcador/fretes", label: "Fretes", icon: <Package className="h-5 w-5" /> },
        { to: "/embarcador/publicar", label: "Publicar", icon: <PlusCircle className="h-5 w-5" /> },
        { to: "/embarcador/viagens", label: "Viagens", icon: <TruckIcon className="h-5 w-5" /> },
        { to: "/embarcador/faturas", label: "Faturas", icon: <FileText className="h-5 w-5" /> },
        { to: "/embarcador/perfil", label: "Perfil", icon: <User className="h-5 w-5" /> },
      ]}
    />
  );
}

export function ProviderNav() {
  return (
    <BottomNav
      items={[
        { to: "/motorista/buscar", label: "Buscar", icon: <Search className="h-5 w-5" /> },
        { to: "/motorista/propostas", label: "Propostas", icon: <ListChecks className="h-5 w-5" /> },
        { to: "/motorista/viagens", label: "Viagens", icon: <TruckIcon className="h-5 w-5" /> },
        { to: "/motorista/perfil", label: "Perfil", icon: <User className="h-5 w-5" /> },
      ]}
    />
  );
}
