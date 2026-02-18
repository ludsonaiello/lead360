LiveKit docs › Understanding LiveKit › Rooms, participants, & tracks › Webhooks & events

---

# Webhooks & events

> Configure webhooks and handle events to monitor and respond to changes in rooms, participants, and tracks.

## Overview

LiveKit provides two mechanisms for monitoring and responding to changes in rooms, participants, and tracks:

- **Webhooks**: Server-side notifications sent to your backend when room and participant events occur
- **Events**: Client-side event system in the SDKs that allows your application to respond to state changes in realtime

These mechanisms enable you to build reactive applications that stay synchronized with room state and respond to changes as they happen.

## Managing webhooks

Webhooks enable your backend to receive realtime notifications about room and participant events. Use webhooks to integrate LiveKit with your application logic, trigger actions, and maintain state synchronization.

### Configuration

With Cloud, webhooks can be configured in the Settings section of your project's dashboard.

When self-hosting, webhooks can be enabled by setting the `webhook` section in your config.

For Egress, extra webhooks can also be [configured inside Egress requests](https://docs.livekit.io/reference/other/egress/api.md#WebhookConfig).

```yaml
webhook:
  # The API key to use in order to sign the message
  # This must match one of the keys LiveKit is configured with
  api_key: 'api-key-to-sign-with'
  urls:
    - 'https://yourhost'

```

### Receiving webhooks

Webhook requests are HTTP POST requests sent to URLs that you specify in your config or LiveKit Cloud dashboard. A `WebhookEvent` is encoded as JSON and sent in the body of the request.

The `Content-Type` header of the request is set to `application/webhook+json`. Please ensure your webserver is configured to receive payloads with this content type.

To ensure webhook requests are coming from LiveKit, these requests have an `Authorization` header containing a signed JWT token. The token includes a sha256 hash of the payload.

LiveKit's server SDKs provide webhook receiver libraries which should help with validation and decoding of the payload.

**Node.js**:

```typescript
import { WebhookReceiver } from 'livekit-server-sdk';

const receiver = new WebhookReceiver('apikey', 'apisecret');

// In order to use the validator, WebhookReceiver must have access to the raw
// POSTed string (instead of a parsed JSON object). If you are using express
// middleware, ensure that `express.raw` is used for the webhook endpoint
// app.use(express.raw({type: 'application/webhook+json'}));

app.post('/webhook-endpoint', async (req, res) => {
  // Event is a WebhookEvent object
  const event = await receiver.receive(req.body, req.get('Authorization'));
});

```

---

**Go**:

```go
import (
  "github.com/livekit/protocol/auth"
  "github.com/livekit/protocol/livekit"
  "github.com/livekit/protocol/webhook"
)

func ServeHTTP(w http.ResponseWriter, r *http.Request) {
  authProvider := auth.NewSimpleKeyProvider(
    apiKey, apiSecret,
  )
  // Event is a livekit.WebhookEvent{} object
  event, err := webhook.ReceiveWebhookEvent(r, authProvider)
  if err != nil {
    // Could not validate, handle error
    return
  }
  // Consume WebhookEvent
}

```

---

**Java**:

```java
import io.livekit.server.*;

WebhookReceiver webhookReceiver = new WebhookReceiver("apiKey", "secret");

// postBody is the raw POSTed string.
// authHeader is the value of the "Authorization" header in the request.
LivekitWebhook.WebhookEvent event = webhookReceiver.receive(postBody, authHeader);

// Consume WebhookEvent

```

### Delivery and retries

Webhooks are HTTP requests initiated by LiveKit and sent to your backend. Due to the protocol's push-based nature, there are no guarantees around delivery.

LiveKit aims to mitigate transient failures by retrying a webhook request multiple times. Each message will undergo several delivery attempts before being abandoned. If multiple events are queued for delivery, LiveKit will properly sequence them; only delivering newer events after older ones have been delivered or abandoned.

### Webhook events

In addition to the fields below, all webhook events will include the following fields:

- `id` - a UUID identifying the event
- `createdAt` - UNIX timestamp in seconds

#### Room Started

```typescript
interface WebhookEvent {
  event: 'room_started';
  room: Room;
}

```

#### Room Finished

```typescript
interface WebhookEvent {
  event: 'room_finished';
  room: Room;
}

```

#### Participant Joined

```typescript
interface WebhookEvent {
  event: 'participant_joined';
  room: Room;
  participant: ParticipantInfo;
}

```

#### Participant Left

```typescript
interface WebhookEvent {
  event: 'participant_left';
  room: Room;
  participant: ParticipantInfo;
}

```

#### Participant Connection Aborted

```typescript
interface WebhookEvent {
  event: 'participant_connection_aborted';
  room: Room;
  participant: ParticipantInfo;
}

```

#### Track Published

In the Room and Participant objects, only sid, identity, and name are sent.

```typescript
interface WebhookEvent {
  event: 'track_published';
  room: Room;
  participant: ParticipantInfo;
  track: TrackInfo;
}

```

#### Track Unpublished

In the Room and Participant objects, only sid, identity, and name are sent.

```typescript
interface WebhookEvent {
  event: 'track_unpublished';
  room: Room;
  participant: ParticipantInfo;
  track: TrackInfo;
}

```

#### Egress Started

```typescript
interface WebhookEvent {
  event: 'egress_started';
  egressInfo: EgressInfo;
}

```

#### Egress Updated

```typescript
interface WebhookEvent {
  event: 'egress_updated';
  egressInfo: EgressInfo;
}

```

#### Egress Ended

```typescript
interface WebhookEvent {
  event: 'egress_ended';
  egressInfo: EgressInfo;
}

```

#### Ingress Started

```typescript
interface WebhookEvent {
  event: 'ingress_started';
  ingressInfo: IngressInfo;
}

```

#### Ingress Ended

```typescript
interface WebhookEvent {
  event: 'ingress_ended';
  ingressInfo: IngressInfo;
}

```

## Handling events

The LiveKit SDKs use events to communicate with the application changes that are taking place in the room.

There are two kinds of events, **room events** and **participant events**. Room events are emitted from the main `Room` object, reflecting any change in the room. Participant events are emitted from each `Participant`, when that specific participant has changed.

Room events are generally a superset of participant events. As you can see, some events are fired on both `Room` and `Participant`; this is intentional. This duplication is designed to make it easier to componentize your application. For example, if you have a UI component that renders a participant, it should only listen to events scoped to that participant.

### Declarative UI

Event handling can be quite complicated in a realtime, multi-user system. Participants could be joining and leaving, each publishing tracks or muting them. To simplify this, LiveKit offers built-in support for [declarative UI](https://alexsidorenko.com/blog/react-is-declarative-what-does-it-mean/) for most platforms.

With declarative UI you specify the how the UI should look given a particular state, without having to worry about the sequence of transformations to apply. Modern frameworks are highly efficient at detecting changes and rendering only what's changed.

**React**:

We offer a few hooks and components that makes working with React much simpler.

- [useParticipant](https://docs.livekit.io/reference/components/react/hook/useparticipants.md) - maps participant events to state
- [useTracks](https://docs.livekit.io/reference/components/react/hook/usetracks.md) - returns the current state of the specified audio or video track
- [VideoTrack](https://docs.livekit.io/reference/components/react/component/videotrack.md) - React component that renders a video track
- [RoomAudioRenderer](https://docs.livekit.io/reference/components/react/component/roomaudiorenderer.md) - React component that renders the sound of all audio tracks

```tsx
const Stage = () => {
  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare]);
  return (
    <SessionProvider session={/* ... */}>
      // Render all video
      {tracks.map((track) => {
        <VideoTrack trackRef={track} />;
      })}
      // ...and all audio tracks.
      <RoomAudioRenderer />
    </SessionProvider>
  );
};

function ParticipantList() {
  // Render a list of all participants in the room.
  const participants = useParticipants();
  <ParticipantLoop participants={participants}>
    <ParticipantName />
  </ParticipantLoop>;
}

```

---

**SwiftUI**:

Most core objects in the Swift SDK, including `Room`, `Participant`, and `TrackReference`, implement the `ObservableObject` protocol so they are ready-made for use with SwiftUI.

For the simplest integration, the [Swift Components SDK](https://github.com/livekit/components-swift) contains ready-made utilities for modern SwiftUI apps, built on `.environmentObject`:

- `RoomScope` - creates and (optionally) connects to a `Room`, leaving upon dismissal
- `ForEachParticipant` - iterates each `Participant` in the current room, automatically updating
- `ForEachTrack` - iterates each `TrackReference` on the current participant, automatically updating

```swift
struct MyChatView: View {
    var body: some View {
        RoomScope(url: /* URL */,
                  token: /* Token */,
                  connect: true,
                  enableCamera: true,
                  enableMicrophone: true) {
            VStack {
                ForEachParticipant { _ in
                    VStack {
                        ForEachTrack(filter: .video) { _ in
                            MyVideoView()
                                .frame(width: 100, height: 100)
                        }
                    }
                }
            }
        }
    }
}

struct MyVideoView: View {
  @EnvironmentObject private var trackReference: TrackReference

  var body: some View {
      VideoTrackView(trackReference: trackReference)
        .frame(width: 100, height: 100)
  }
}

```

---

**Android Compose**:

The `Room` and `Participant` objects have built-in `Flow` support. Any property marked with a `@FlowObservable` annotation can be observed with the `flow` utility method. It can be used like this:

```kotlin
@Composable
fun Content(
  room: Room
) {
  val remoteParticipants by room::remoteParticipants.flow.collectAsState(emptyMap())
  val remoteParticipantsList = remoteParticipants.values.toList()
  LazyRow {
      items(
          count = remoteParticipantsList.size,
          key = { index -> remoteParticipantsList[index].sid }
      ) { index ->
          ParticipantItem(room = room, participant = remoteParticipantsList[index])
      }
  }
}

@Composable
fun ParticipantItem(
    room: Room,
    participant: Participant,
) {
  val videoTracks by participant::videoTracks.flow.collectAsState(emptyList())
  val subscribedTrack = videoTracks.firstOrNull { (pub) -> pub.subscribed } ?: return
  val videoTrack = subscribedTrack.second as? VideoTrack ?: return

  VideoTrackView(
      room = room,
      videoTrack = videoTrack,
  )
}

```

---

**Flutter**:

Flutter supports [declarative UI](https://docs.flutter.dev/get-started/flutter-for/declarative) by default. The LiveKit SDK notifies changes in two ways:

- ChangeNotifier - generic notification of changes. This is useful when you are building reactive UI and only care about changes that may impact rendering
- EventsListener<Event> - listener pattern to listen to specific events (see [events.dart](https://github.com/livekit/client-sdk-flutter/blob/main/lib/src/events.dart))

```dart
class RoomWidget extends StatefulWidget {
  final Room room;

  RoomWidget(this.room);

  @override
  State<StatefulWidget> createState() {
    return _RoomState();
  }
}

class _RoomState extends State<RoomWidget> {
  late final EventsListener<RoomEvent> _listener = widget.room.createListener();

  @override
  void initState() {
    super.initState();
    // used for generic change updates
    widget.room.addListener(_onChange);

    // Used for specific events
    _listener
      ..on<RoomDisconnectedEvent>((_) {
        // handle disconnect
      })
      ..on<ParticipantConnectedEvent>((e) {
        print("participant joined: ${e.participant.identity}");
      })
  }

  @override
  void dispose() {
    // Be sure to dispose listener to stop listening to further updates
    _listener.dispose();
    widget.room.removeListener(_onChange);
    super.dispose();
  }

  void _onChange() {
    // Perform computations and then call setState
    // setState will trigger a build
    setState(() {
      // your updates here
    });
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    // Builds a room layout with a main participant in the center, and a row of
    // participants at the bottom.
    // ParticipantWidget is located here: https://github.com/livekit/client-sdk-flutter/blob/main/example/lib/widgets/participant.dart
    body: Column(
      children: [
        Expanded(
            child: participants.isNotEmpty
                ? ParticipantWidget.widgetFor(participants.first)
                : Container()),
        SizedBox(
          height: 100,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            itemCount: math.max(0, participants.length - 1),
            itemBuilder: (BuildContext context, int index) => SizedBox(
              width: 100,
              height: 100,
              child: ParticipantWidget.widgetFor(participants[index + 1]),
            ),
          ),
        ),
      ],
    ),
  );
}

```

### SDK events

This table captures a consistent set of events that are available across platform SDKs. In addition to what's listed here, there may be platform-specific events on certain platforms.

| Event | Description | Room Event | Participant Event |
| **ParticipantConnected** | A RemoteParticipant joins _after_ the local participant. | ✔️ |  |
| **ParticipantDisconnected** | A RemoteParticipant leaves | ✔️ |  |
| **Reconnecting** | The connection to the server has been interrupted and it's attempting to reconnect. | ✔️ |  |
| **Reconnected** | Reconnection has been successful | ✔️ |  |
| **Disconnected** | Disconnected from room due to the room closing or unrecoverable failure | ✔️ |  |
| **TrackPublished** | A new track is published to room after the local participant has joined | ✔️ | ✔️ |
| **TrackUnpublished** | A RemoteParticipant has unpublished a track | ✔️ | ✔️ |
| **TrackSubscribed** | The LocalParticipant has subscribed to a track | ✔️ | ✔️ |
| **TrackUnsubscribed** | A previously subscribed track has been unsubscribed | ✔️ | ✔️ |
| **TrackMuted** | A track was muted, fires for both local tracks and remote tracks | ✔️ | ✔️ |
| **TrackUnmuted** | A track was unmuted, fires for both local tracks and remote tracks | ✔️ | ✔️ |
| **LocalTrackPublished** | A local track was published successfully | ✔️ | ✔️ |
| **LocalTrackUnpublished** | A local track was unpublished | ✔️ | ✔️ |
| **ActiveSpeakersChanged** | Current active speakers has changed | ✔️ |  |
| **IsSpeakingChanged** | The current participant has changed speaking status |  | ✔️ |
| **ConnectionQualityChanged** | Connection quality was changed for a Participant | ✔️ | ✔️ |
| **ParticipantAttributesChanged** | A participant's attributes were updated | ✔️ | ✔️ |
| **ParticipantMetadataChanged** | A participant's metadata was updated | ✔️ | ✔️ |
| **RoomMetadataChanged** | Metadata associated with the room has changed | ✔️ |  |
| **DataReceived** | Data received from another participant or server | ✔️ | ✔️ |
| **TrackStreamStateChanged** | Indicates if a subscribed track has been paused due to bandwidth | ✔️ | ✔️ |
| **TrackSubscriptionPermissionChanged** | One of subscribed tracks have changed track-level permissions for the current participant | ✔️ | ✔️ |
| **ParticipantPermissionsChanged** | When the current participant's permissions have changed | ✔️ | ✔️ |

---

This document was rendered at 2026-02-17T23:42:00.753Z.
For the latest version of this document, see [https://docs.livekit.io/intro/basics/rooms-participants-tracks/webhooks-events.md](https://docs.livekit.io/intro/basics/rooms-participants-tracks/webhooks-events.md).

To explore all LiveKit documentation, see [llms.txt](https://docs.livekit.io/llms.txt).