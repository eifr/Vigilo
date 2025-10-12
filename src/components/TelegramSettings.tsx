import { QRCodeCanvas } from "qrcode.react";
import { Checkbox } from "@/components/ui/checkbox";
import { TelegramSetupGuide } from "./TelegramSetupGuide";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Key, MessageCircle, Clock, CheckCircle } from "lucide-react";

interface TelegramSettingsProps {
  sendTelegrams: boolean;
  setSendTelegrams: (value: boolean) => void;
  telegramBotToken: string;
  setTelegramBotToken: (value: string) => void;
  telegramChatId: string;
  debounceTime: number;
  setDebounceTime: (value: number) => void;
  botUsername: string;
}

export function TelegramSettings({
  sendTelegrams,
  setSendTelegrams,
  telegramBotToken,
  setTelegramBotToken,
  telegramChatId,
  debounceTime,
  setDebounceTime,
  botUsername,
}: TelegramSettingsProps) {
  return (
        <Card className="w-full max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              Telegram Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <TelegramSetupGuide botUsername={botUsername} telegramChatId={telegramChatId} />
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="send-telegrams"
                  checked={sendTelegrams}
                  onCheckedChange={setSendTelegrams}
                />
                <Label htmlFor="send-telegrams">
                  Send Telegram message on motion
                </Label>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bot-token" className="flex items-center gap-2">
                  <Key className="w-4 h-4" />
                  Telegram Bot Token
                  {botUsername && <CheckCircle className="w-4 h-4 text-green-500" />}
                </Label>
                <Input
                  id="bot-token"
                  type="password"
                  placeholder="Paste your Telegram Bot Token here"
                  value={telegramBotToken}
                  onInput={(e) =>
                    setTelegramBotToken((e.target as HTMLInputElement).value)
                  }
                />
              </div>
              {botUsername && (
                <div className="text-center p-4 border rounded-lg bg-muted/40 space-y-2">
                  <p>
                    Click the link to start a chat with your bot:{" "}
                    <a
                      href={`https://t.me/${botUsername}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      @{botUsername}
                    </a>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Or scan this QR code:
                  </p>
                  <div className="flex justify-center mt-2">
                    <QRCodeCanvas
                      value={`https://t.me/${botUsername}`}
                      size={128}
                    />
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="chat-id" className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4" />
                  Your Chat ID
                  {telegramChatId && <CheckCircle className="w-4 h-4 text-green-500" />}
                </Label>
                <Input
                  id="chat-id"
                  type="text"
                  placeholder="Will be detected automatically"
                  value={telegramChatId}
                  readOnly
                  className="text-center font-mono"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="debounce-time" className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Debounce Time (ms)
              </Label>
              <Input
                id="debounce-time"
                type="number"
                value={debounceTime}
                onInput={(e) =>
                  setDebounceTime(
                    parseInt((e.target as HTMLInputElement).value, 10)
                  )
                }
              />
            </div>
          </CardContent>
        </Card>
  );
}
