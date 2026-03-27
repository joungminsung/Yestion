import type { ReactNode } from "react";
import type { PropertyType } from "@/types/database";
import {
  Type, Hash, ChevronDown, LayoutGrid, Calendar,
  User, Paperclip, CheckSquare, Link, Mail, Phone,
  FunctionSquare, ArrowLeftRight, Sigma, Clock, Circle,
} from "lucide-react";

/** Single source of truth for property type icons */
export function propertyTypeIcon(type: PropertyType | string): ReactNode {
  const size = 14;
  const icons: Record<string, ReactNode> = {
    title: <Type size={size} />,
    text: <Type size={size} />,
    number: <Hash size={size} />,
    select: <ChevronDown size={size} />,
    multi_select: <LayoutGrid size={size} />,
    date: <Calendar size={size} />,
    person: <User size={size} />,
    file: <Paperclip size={size} />,
    files: <Paperclip size={size} />,
    checkbox: <CheckSquare size={size} />,
    url: <Link size={size} />,
    email: <Mail size={size} />,
    phone: <Phone size={size} />,
    formula: <FunctionSquare size={size} />,
    relation: <ArrowLeftRight size={size} />,
    rollup: <Sigma size={size} />,
    created_time: <Clock size={size} />,
    created_by: <User size={size} />,
    last_edited_time: <Clock size={size} />,
    last_edited_by: <User size={size} />,
    status: <Circle size={size} />,
  };
  return icons[type] || <Type size={size} />;
}
