import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  BookText,
  LayoutDashboard,
  User,
  ChevronLeft,
  ChevronRight,
  Upload,
  Gamepad,
  FileText,
  Share2,
  ChevronDown,
  ChevronUp,
  Wallet2Icon,
} from "lucide-react";

const Sidebar = ({ isOpen, onClose }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isRecordsOpen, setIsRecordsOpen] = useState(true);

  const toggleSidebar = () => {
    setIsExpanded(!isExpanded);
  };

  const toggleRecords = () => {
    setIsRecordsOpen(!isRecordsOpen);
  };

  const links = [
    {
      to: "/Health-Professional/Home",
      icon: <LayoutDashboard />,
      text: "Dashboard",
    },
    {
      to: "/Health-Professional/Records",
      icon: <BookText />,
      text: "Records",
      subMenu: [
        {
          to: "/Health-Professional/Records/Your-Records",
          icon: <FileText />,
          text: "Your Records",
        },
        {
          to: "/Health-Professional/Records/Shared-With-You",
          icon: <Share2 />,
          text: "Shared with You",
        },
      ],
    },
    { to: "/Health-Professional/Upload", icon: <Upload />, text: "Upload" },
    {
      to: "/Health-Professional/Assets",
      icon: <Wallet2Icon />,
      text: "Assets",
    },
    {
      to: "/Health-Professional/Gamification",
      icon: <Gamepad />,
      text: "Gamification",
    },
    { to: "/Health-Professional/Profile", icon: <User />, text: "Profile" },
  ];

  return (
    <aside
      className={`bg-sidebar z-50 h-full transition-transform duration-300 ease-in-out
        ${isExpanded ? "w-64" : "w-20"} 
        ${isOpen ? "fixed inset-y-0 left-0 z-50 border-r border-sidebar-border" : "lg:relative"}
        ${isOpen || !isExpanded ? "" : "hidden lg:block"}`}
    >
      <div className="h-full flex flex-col items-center px-3 py-4 overflow-y-auto transition-all duration-300 ease-in-out">
        <div className="flex items-center justify-center w-full mb-5">
          {isExpanded && (
            <img
              alt="Logo"
              className="h-8 transition-opacity duration-300 ease-in-out dark:brightness-0 dark:invert"
              src="/assets/logo.svg"
            />
          )}
          <button
            onClick={toggleSidebar}
            className={`text-sidebar-foreground focus:outline-none transition-transform duration-300 ease-in-out ${
              isExpanded ? "ml-auto" : ""
            }`}
          >
            {isExpanded ? (
              <ChevronLeft
                size="32"
                className="border border-sidebar-border p-1 rounded-lg"
              />
            ) : (
              <ChevronRight
                size="32"
                className="border border-sidebar-border p-1 rounded-lg"
              />
            )}
          </button>
        </div>
        <ul className="space-y-2 font-medium w-full">
          {links.map((link, index) => (
            <li
              key={index}
              className="relative group w-full"
            >
              {link.subMenu ? (
                <div>
                  {isExpanded ? (
                    <button
                      onClick={toggleRecords}
                      className="flex items-center justify-start w-full p-2 text-sidebar-foreground rounded-lg transition-all duration-300 ease-in-out hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    >
                      <span>{link.icon}</span>
                      <span className="ml-3">{link.text}</span>
                      <span className="ml-auto">
                        {isRecordsOpen ? (
                          <ChevronUp size={16} />
                        ) : (
                          <ChevronDown size={16} />
                        )}
                      </span>
                    </button>
                  ) : (
                    <div className="py-2">
                      <div className="border-t border-sidebar-border mb-2"></div>
                    </div>
                  )}
                  {(isRecordsOpen || !isExpanded) && (
                    <ul className={`space-y-2 ${isExpanded ? "pl-4" : "pl-0"}`}>
                      {link.subMenu.map((subLink, subIndex) => (
                        <li key={subIndex}>
                          <NavLink
                            to={subLink.to}
                            onClick={onClose}
                            className={({ isActive }) =>
                              `flex items-center ${
                                isExpanded ? "justify-start" : "justify-center"
                              } p-2 text-sidebar-foreground rounded-lg transition-all duration-300 ease-in-out hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${
                                isActive
                                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                                  : ""
                              }`
                            }
                          >
                            <span>{subLink.icon}</span>
                            {isExpanded && (
                              <span className="ml-3">{subLink.text}</span>
                            )}
                          </NavLink>
                        </li>
                      ))}
                    </ul>
                  )}
                  {!isExpanded && (
                    <div className="py-2">
                      <div className="border-t border-sidebar-border mt-2"></div>
                    </div>
                  )}
                </div>
              ) : (
                <NavLink
                  to={link.to}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center ${
                      isExpanded ? "justify-start" : "justify-center"
                    } p-2 text-sidebar-foreground rounded-lg transition-all duration-300 ease-in-out hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${
                      isActive
                        ? "bg-sidebar-primary text-sidebar-primary-foreground"
                        : ""
                    }`
                  }
                >
                  <span>{link.icon}</span>
                  {isExpanded && <span className="ml-3">{link.text}</span>}
                </NavLink>
              )}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
};

export default Sidebar;
