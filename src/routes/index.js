import { Router } from 'express';
import moviesRouter from './movies.routes.js';
import behindTheLensRouter from './behindTheLens.routes.js';
import submissionsRouter from './submissions.routes.js';
import userRouter from './user.routes.js';
import subscriptionRouter from './subscription.routes.js';

const apiRouter = Router();

apiRouter.use('/movies', moviesRouter);
apiRouter.use('/behind-the-lens', behindTheLensRouter);
apiRouter.use('/submissions', submissionsRouter);
apiRouter.use('/user', userRouter);
apiRouter.use('/auth', userRouter);
apiRouter.use('/subscription', subscriptionRouter);

export { moviesRouter, behindTheLensRouter, submissionsRouter, userRouter, subscriptionRouter };
export default apiRouter;

