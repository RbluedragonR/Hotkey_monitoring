import type { ReactNode } from "react"; // ✅ type-only import
import Navbar from "./Navbar";
interface LayoutProps {
    children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
    return (
        <div className="w-full flex flex-col items-center rounded-sm">
            <Navbar />
            {children}
        </div>
    );
};

export default Layout;