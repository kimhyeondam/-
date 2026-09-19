"use client";
// 회사 이름·약칭·비서 이름을 화면(클라이언트) 어디서나 쓰기 위한 묶음.
// 대시보드 레이아웃이 서버에서 읽은 회사 정보로 값을 넣어 주고, 화면은 useBrand() 로 읽습니다.
import { createContext, useContext } from "react";
import { company as sampleCompany } from "@/data/sample";

export interface Brand { name: string; shortName: string; assistantName: string; ownerName: string }
export const defaultBrand: Brand = { name: sampleCompany.name, shortName: sampleCompany.shortName, assistantName: sampleCompany.assistantName, ownerName: sampleCompany.ownerName };

const BrandContext = createContext<Brand>(defaultBrand);
export function BrandProvider({ value, children }: { value: Brand; children: React.ReactNode }) { return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>; }
export function useBrand(): Brand { return useContext(BrandContext); }
