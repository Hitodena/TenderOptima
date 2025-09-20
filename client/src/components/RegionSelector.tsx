import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown } from "lucide-react";
import { regionsData, type Country, type Region, type City } from "@/data/regions";

interface RegionSelectorProps {
  selectedRegion?: string | null;
  selectedRegions?: string[];
  onRegionSelect?: (region: string | null) => void;
  onRegionsChange?: (regions: string[]) => void;
  placeholder?: string;
  className?: string;
  isMulti?: boolean;
}

export default function RegionSelector({ 
  selectedRegion, 
  selectedRegions = [],
  onRegionSelect, 
  onRegionsChange,
  placeholder = "Выберите регион",
  className = "",
  isMulti = false
}: RegionSelectorProps) {
  const [showRegionDialog, setShowRegionDialog] = useState(false);
  const [expandedCountries, setExpandedCountries] = useState<Set<string>>(new Set());
  const [expandedRegions, setExpandedRegions] = useState<Set<string>>(new Set());

  // Handle region selection (single or multiple selection)
  const handleRegionSelect = (regionName: string) => {
    if (isMulti && onRegionsChange) {
      // Множественный выбор
      const isSelected = selectedRegions.includes(regionName);
      
      if (isSelected) {
        // Удаляем регион из списка
        const updatedRegions = selectedRegions.filter(r => r !== regionName);
        onRegionsChange(updatedRegions);
      } else {
        // Добавляем регион в список
        const updatedRegions = [...selectedRegions, regionName];
        onRegionsChange(updatedRegions);
      }
    } else if (onRegionSelect) {
      // Одиночный выбор
      if (selectedRegion === regionName) {
        onRegionSelect(null);
      } else {
        onRegionSelect(regionName);
      }
    }
  };

  // Handle country expansion toggle
  const toggleCountryExpansion = (countryName: string) => {
    const newExpanded = new Set(expandedCountries);
    if (newExpanded.has(countryName)) {
      newExpanded.delete(countryName);
    } else {
      newExpanded.add(countryName);
    }
    setExpandedCountries(newExpanded);
  };

  // Handle region expansion toggle
  const toggleRegionExpansion = (regionName: string) => {
    const newExpanded = new Set(expandedRegions);
    if (newExpanded.has(regionName)) {
      newExpanded.delete(regionName);
    } else {
      newExpanded.add(regionName);
    }
    setExpandedRegions(newExpanded);
  };

  const handleConfirm = () => {
    setShowRegionDialog(false);
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className={`w-full justify-start ${className}`}
        onClick={() => setShowRegionDialog(true)}
      >
        {isMulti 
          ? (selectedRegions.length > 0 
              ? `Выбрано регионов: ${selectedRegions.length}` 
              : placeholder)
          : (selectedRegion || placeholder)
        }
      </Button>
      
      <Dialog open={showRegionDialog} onOpenChange={setShowRegionDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isMulti ? "Выберите регионы" : "Выберите регион"}</DialogTitle>
            <DialogDescription>
              {isMulti ? "Выберите один или несколько регионов из списка" : "Выберите один регион из списка"}
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-1">
              {regionsData.map((country) => (
                <div key={country.name}>
                  {/* Страна */}
                  <div className="flex flex-row items-center space-x-2 space-y-0 rounded-md py-1">
                    <Checkbox
                      checked={isMulti ? selectedRegions.includes(country.name) : selectedRegion === country.name}
                      onCheckedChange={() => handleRegionSelect(country.name)}
                    />
                    <div className="flex items-center space-x-2 flex-1">
                      <label 
                        className="text-sm cursor-pointer flex-1 font-medium" 
                        onClick={() => handleRegionSelect(country.name)}
                      >
                        {country.name}
                      </label>
                      {country.regions.length > 0 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-4 w-4 p-0"
                          onClick={() => toggleCountryExpansion(country.name)}
                        >
                          <ChevronDown 
                            className={`h-3 w-3 transition-transform ${
                              expandedCountries.has(country.name) ? 'rotate-180' : ''
                            }`} 
                          />
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {/* Регионы страны */}
                  {country.regions.length > 0 && expandedCountries.has(country.name) && (
                    <div className="ml-6 space-y-1">
                      {country.regions.map((region) => (
                        <div key={region.name}>
                          {/* Регион */}
                          <div className="flex flex-row items-center space-x-2 space-y-0 rounded-md py-1">
                                  <Checkbox
                                    checked={isMulti ? selectedRegions.includes(region.name) : selectedRegion === region.name}
                                    onCheckedChange={() => handleRegionSelect(region.name)}
                                  />
                            <div className="flex items-center space-x-2 flex-1">
                              <label 
                                className="text-sm cursor-pointer flex-1" 
                                onClick={() => handleRegionSelect(region.name)}
                              >
                                {region.name}
                              </label>
                              {region.cities.length > 0 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-4 w-4 p-0"
                                  onClick={() => toggleRegionExpansion(region.name)}
                                >
                                  <ChevronDown 
                                    className={`h-3 w-3 transition-transform ${
                                      expandedRegions.has(region.name) ? 'rotate-180' : ''
                                    }`} 
                                  />
                                </Button>
                              )}
                            </div>
                          </div>
                          
                          {/* Города региона */}
                          {region.cities.length > 0 && expandedRegions.has(region.name) && (
                            <div className="ml-6 space-y-1">
                              {region.cities.map((city) => (
                                <div
                                  key={city.name}
                                  className="flex flex-row items-center space-x-2 space-y-0 rounded-md py-1"
                                >
                                          <Checkbox
                                            checked={isMulti ? selectedRegions.includes(city.name) : selectedRegion === city.name}
                                            onCheckedChange={() => handleRegionSelect(city.name)}
                                          />
                                  <label 
                                    className="text-sm cursor-pointer flex-1" 
                                    onClick={() => handleRegionSelect(city.name)}
                                  >
                                    {city.name}
                                  </label>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
          
          <DialogFooter>
            <Button 
              type="button" 
              onClick={handleConfirm}
            >
              Подтвердить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
