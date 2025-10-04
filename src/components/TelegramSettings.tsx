import { QRCodeCanvas } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TelegramSettingsProps {
  sendTelegrams: boolean;
  setSendTelegrams: (value: boolean) => void;
  telegramBotToken: string;
  setTelegramBotToken: (value: string) => void;
  telegramChatId: string;
  debounceTime: number;
  setDebounceTime: (value: number) => void;
  onStartChat: () => void;
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
  onStartChat,
  botUsername,
}: TelegramSettingsProps) {
  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Telegram Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
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
          <Label htmlFor="bot-token">Telegram Bot Token</Label>
          <Input
            id="bot-token"
            type="text"
            placeholder="Telegram Bot Token"
            value={telegramBotToken}
            onInput={(e) =>
              setTelegramBotToken((e.target as HTMLInputElement).value)
            }
          />
        </div>
        <Button
          onClick={onStartChat}
          disabled={!telegramBotToken}
          className="w-full"
        >
          Start Chat
        </Button>
        <div className="space-y-2">
          <Label htmlFor="chat-id">Chat ID</Label>
          <Input
            id="chat-id"
            type="text"
            placeholder="Chat ID will appear here"
            value={telegramChatId}
            readOnly
          />
        </div>
        {botUsername && (
          <div className="text-center">
            <p>Or scan this QR code:</p>
            <div className="flex justify-center mt-2">
              <QRCodeCanvas value={`https://t.me/${botUsername}`} />
            </div>
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="debounce-time">Debounce time (ms)</Label>
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
