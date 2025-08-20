import { useEffect } from "react";
import type { ReactNode } from "react"; // ✅ type-only import
import Navbar from "./Navbar";
interface LayoutProps {
    children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
    useEffect(() => {
        const hasReloaded = sessionStorage.getItem("hasReloaded");

        if (!hasReloaded) {
            sessionStorage.setItem("hasReloaded", "true");
            window.location.reload();
        }
    }, []);
    return (
        <div className="w-full flex flex-col items-center rounded-sm">
            <Navbar />
            {children}
        </div>
    );
};

export default Layout;