import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import React from "react";
import { Session } from "sip.js/lib/api/session";
import { SessionManager } from "sip.js/lib/platform/web";
import { ErrorMessageLevel1, ErrorMessageLevel2 } from "../enums/error";
import { ProviderContext } from "../context/SIPProviderContext";
import {
  RegisterStatus,
  SIPAccount,
  SIPProviderOptions,
  CONNECT_STATUS,
  SessionTimer,
} from "../type";

export const SIPProvider: React.FunctionComponent<{
  options: SIPProviderOptions;
  children?: ReactNode;
}> = ({ options, children }) => {
  const refAudioRemote = useRef<HTMLAudioElement>(null);

  const [sessions, setSessions] = useState<Record<string, Session>>({});
  const [sessionTimer, setSessionTimer] = useState<SessionTimer>({});
  const [sessionManager, setSessionManager] = useState<SessionManager | null>(
    null
  );
  const [connectStatus, setStatus] = useState<CONNECT_STATUS>(
    CONNECT_STATUS.WAIT_REQUEST_CONNECT
  );
  const [registerStatus, setRegisterStatus] = useState<RegisterStatus>(
    RegisterStatus.UNREGISTERED
  );

  const updateSession = useCallback(
    (session: Session) => {
      setSessions((sessions) => ({
        ...sessions,
        [session.id]: session,
      }));
    },
    [setSessions]
  );

  const connectAndRegister = useCallback((sipAccount: SIPAccount) => {
    const sessionManager = new SessionManager(options.webSocketServer, {
      aor: `sip:${sipAccount.username}@${options.domain}`,
      userAgentOptions: {
        authorizationUsername: sipAccount.username,
        authorizationPassword: sipAccount.password,
      },
      media: {
        constraints: {
          audio: true,
          video: false,
        },
        remote: {
          audio: refAudioRemote.current as HTMLAudioElement,
        },
      },
      delegate: {
        onCallCreated: (session) => {
          console.log("fefefe", { state: session.state });
          session.stateChange.addListener((state) => {
            console.info(
              ErrorMessageLevel1.SIP_PROVIDER,
              `Session ${session.id} changed to ${state}`
            );
            updateSession(session);
          });
          updateSession(session);
        },
        onCallAnswered: (session) => {
          updateSession(session);
          setSessionTimer((timer) => ({
            ...timer,
            [session.id]: {
              startAt: new Date(),
            },
          }));
        },
        onCallHangup: (session) => {
          updateSession(session);
          setSessionTimer((timer) => ({
            ...timer,
            [session.id]: {
              ...(timer[session.id] || {}),
              endAt: new Date(),
            },
          }));
        },
        onCallReceived: (session) => {
          updateSession(session);
          setSessionTimer((timer) => ({
            ...timer,
            [session.id]: {
              ...(timer[session.id] || {}),
              receivedAt: new Date(),
            },
          }));
        },
        onRegistered: () => {
          setRegisterStatus(RegisterStatus.REGISTERED);
        },
        onUnregistered: () => {
          setRegisterStatus(RegisterStatus.UNREGISTERED);
        },
        onServerConnect() {
          setStatus(CONNECT_STATUS.CONNECTED);
          sessionManager.register();
        },
        onServerDisconnect(error) {
          console.error(
            ErrorMessageLevel1.SIP_PROVIDER,
            ErrorMessageLevel2.FAILED_CONNECT_SIP_USER,
            error
          );
          setStatus(CONNECT_STATUS.DISCONNECTED);
        },
      },
    });
    setSessionManager(sessionManager);
    sessionManager.connect();
  }, []);

  console.log({ sessionTimer });

  return (
    <>
      <ProviderContext.Provider
        value={{
          connectAndRegister,
          sessionManager,
          connectStatus,
          registerStatus,
          sessions,
        }}
      >
        {children}
      </ProviderContext.Provider>

      <audio ref={refAudioRemote} />
    </>
  );
};
