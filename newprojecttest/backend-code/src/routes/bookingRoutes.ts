import { Router } from 'express';
import { BookingController } from '../controllers/BookingController';
import { authenticateToken } from '../middleware/authMiddleware';

const bookingRouter = Router();
const bookingController = new BookingController();

bookingRouter.use(authenticateToken);

bookingRouter.post('/', (req, res, next) => bookingController.createBooking(req, res, next));
bookingRouter.put('/:id/rebook', (req, res, next) => bookingController.rebookFlight(req, res, next));
bookingRouter.get('/:id', (req, res, next) => bookingController.getBooking(req, res, next));
bookingRouter.get('/:id/checkin', (req, res, next) => bookingController.checkIn(req, res, next));
bookingRouter.get('/:id/boarding-pass', (req, res, next) => bookingController.getBoardingPass(req, res, next));

export { bookingRouter };