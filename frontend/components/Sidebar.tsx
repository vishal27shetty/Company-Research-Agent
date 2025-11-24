import React from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { History, Settings, PlusCircle, MessageSquare } from "lucide-react"

export function Sidebar() {
    return (
        <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
            <div className="flex h-14 items-center px-4 border-b border-sidebar-border">
                <span className="font-mono text-lg font-bold tracking-tight">Search_OS</span>
            </div>

            <div className="flex-1 overflow-hidden py-2">
                <div className="px-4 py-2">
                    <Button
                        variant="secondary"
                        className="w-full justify-start gap-2"
                        onClick={() => window.location.reload()}
                    >
                        <PlusCircle className="h-4 w-4" />
                        New Research
                    </Button>
                </div>

                <Separator className="my-2 bg-sidebar-border" />

                <div className="px-4 py-2">
                    {/* History will be implemented later */}
                </div>
            </div>
        </div>
    )
}
