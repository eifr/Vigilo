import { useState } from "preact/hooks";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { useCameras } from "@/hooks/useCameras";
import { Feed } from "./Feed/Feed";

export const Camera = () => {
  const [showAvailableCameras, setShowAvailableCameras] = useState(false);
  const { availableCameras, refreshDevices, addCamera, activeDeviceIds, getStream } = useCameras();

  const toggleShowAvailableCameras = () => {
    refreshDevices();
    setShowAvailableCameras((prev) => !prev);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cameras</CardTitle>
      </CardHeader>
      <CardContent>
        <Button onClick={toggleShowAvailableCameras}>Add Camera</Button>
        {showAvailableCameras &&
          availableCameras.map(({ label, deviceId }) => (
            <Button
              className="ml-5"
              onClick={() => {
                addCamera(deviceId);
                setShowAvailableCameras(false);
              }}
            >
              {label}
            </Button>
          ))}
        {activeDeviceIds.map((deviceId) => {
          const stream = getStream(deviceId);
          if (!stream) return null;

          return <Feed key={deviceId} stream={stream} />;
        })}
      </CardContent>
    </Card>
  );
};
