import { identity } from "@deso-core/identity";
import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { Nav } from "../components/nav";
import { UserContext } from "../contexts";

export const Root = () => {
  const [userState, setUserState] = useState({
    currentUser: null,
    alternateUsers: null,
    isLoading: true,
  });

  useEffect(
    () => {
        identity.configure({
            // identityURI: "http://localhost:4201",
            spendingLimitOptions: {
                GlobalDESOLimit: 10000000, // 0.01 DESO
                TransactionCountLimitMap: {
                    SUBMIT_POST: 3,
                },
            },
        });

        // Typically, you will want access to the current user throughout your
        // app. Here we subscribe to identity at the root of our app so that we
        // can access the current user in any component and our components will
        // re-render when the current user changes. We can access the current
        // user via the useContext hook from anywhere in our app.
        //
        // example:
        //    const { user } = useContext(UserContext);
        //
        // See src/components/nav.jsx for an concrete use case.
        //
        // NOTE: This function could be chatty. You might want to implement some
        // caching or memoization to reduce unnecessary network calls. We have not
        // done so here for simplicity and to reduce noise from the example.
        identity.subscribe(({currentUser, alternateUsers}) => {
            // NOTE: You can use this callback to update your app state in any way you want.
            // Here we just use a simple useState hook combined with react context. You can
            // use redux, mobx, or any other state management library you want.

            // If your app supports multiple accounts for a user and the current user logs out,
            // you can choose a fallback user to use as the current user from the alternateUsers
            // object. This is a choice you can make depending on the requirements of your own app.
            // Here we just choose the first alternate user as the fallback user. Alternate users
            // are all users that have been logged in to your app and never logged out.
            if (alternateUsers && !currentUser) {
                const fallbackUser = Object.values(alternateUsers)[0];
                identity.setActiveUser(fallbackUser.publicKey);
                // NOTE: setting the active user will trigger a new state change in
                // identity which will re-trigger this callback so we just return
                // here.
                return;
            }

            if (!currentUser) {
                // if no user is logged in or the user has logged out, set our app user state to null
                // All of our components will re-render and update accordingly
                setUserState((state) => ({
                    ...state,
                    currentUser: null,
                    isLoading: false,
                }));
            } else if (
                currentUser?.publicKey !== userState.currentUser?.PublicKeyBase58Check
            ) {
                // if the user is logged in, fetch the user's details from a node and set the app user state
                // All of our components will re-render and update accordingly. We also fetch any alternate users
                // we may have stored in local storage.
                const alternateUserKeys =
                    Object.values(alternateUsers ?? {})?.map((u) => u.publicKey) ?? [];

                // We set isLoading to true so that we can show a loading indicator wherever
                // we reference the user state in our app.
                setUserState((state) => ({
                    ...state,
                    isLoading: true,
                }));

                fetchUsers([currentUser.publicKey, ...alternateUserKeys])
                    .then((userList) => {
                        const [currentUser, ...alternateUsers] = userList;
                        setUserState((state) => ({
                            ...state,
                            currentUser,
                            alternateUsers,
                        }));
                    })
                    .finally(() =>
                        setUserState((state) => ({
                            ...state,
                            isLoading: false,
                        }))
                    );
            }
        })
    },
    [] /* NOTE: We pass an empty array to useEffect so that it only runs once for our entire app session */
  );

  return (
    <UserContext.Provider value={userState}>
      <Nav />
      <div role="main" className="main-content">
        {userState.isLoading ? <div>Loading...</div> : <Outlet />}
      </div>
    </UserContext.Provider>
  );
};

function fetchUsers(keys) {
  // We are using native browser fetch here but feel free to use any HTTP client you prefer.
  return fetch(`https://node.deso.org/api/v0/get-users-stateless`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      PublicKeysBase58Check: keys,
    }),
  })
    .then((res) => res.json())
    .then(({ UserList }) => UserList);
}
